import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { getOrder, listOrders } from "./orders.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

const orderPayload = {
	orderId: "ORD_1", customerId: "CUS_1", customerName: "Jane",
	status: "PENDING", total: 10000, address: "12 Le Loi",
	recipientName: "Jane", phone: "0900000000", items: [],
	createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z",
};

it("parses additive facts through the order response envelope", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: {
			...orderPayload, paymentExpiresAt: "2026-11-11T10:15:00Z",
			cancellationReason: "PAYMENT_EXPIRED",
		},
	}))));
	expect(await getOrder("ORD_1")).toMatchObject({
		paymentExpiresAt: "2026-11-11T10:15:00Z", cancellationReason: "PAYMENT_EXPIRED",
	});
});

it.each([
	{ paymentExpiresAt: "2026-02-30T10:00:00Z" },
	{ cancellationReason: "EXPIRED" },
])("rejects malformed additive facts through detail and list parsers: %j", async (facts) => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const data = { ...orderPayload, ...facts };
	vi.stubGlobal("fetch", vi.fn()
		.mockResolvedValueOnce(new Response(JSON.stringify({ code: 200, message: "OK", data })))
		.mockResolvedValueOnce(new Response(JSON.stringify({
			code: 200, message: "OK",
			data: { content: [data], page: 0, size: 10, totalElements: 1, totalPages: 1 },
		}))));
	await expect(getOrder("ORD_1")).rejects.toBeInstanceOf(ApiError);
	await expect(listOrders({ page: 0, size: 10 })).rejects.toBeInstanceOf(ApiError);
});

it("fetches only the requested server page with encoded filters and metadata", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const page = { content: [], page: 2, size: 10, totalElements: 34, totalPages: 4 };
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: page,
	})));
	vi.stubGlobal("fetch", fetch);

	const result = await listOrders({
		page: 2, size: 10, status: "CONFIRMED", q: "ORD & 1",
		createdAfter: "2026-01-01T00:00:00Z",
	});

	expect(result).toEqual(page);
	expect(fetch).toHaveBeenCalledTimes(1);
	const [url, init] = fetch.mock.calls[0];
	expect(String(url)).toBe("http://localhost:8080/api/v1/orders?page=2&size=10&status=CONFIRMED&q=ORD+%26+1&createdAfter=2026-01-01T00%3A00%3A00Z");
	expect(init.headers.get("Authorization")).toBe("Bearer test-token");
});

it("omits absent filters and rejects malformed page responses", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: [],
	})));
	vi.stubGlobal("fetch", fetch);

	await expect(listOrders({ page: 0, size: 10 })).rejects.toBeInstanceOf(ApiError);
	expect(String(fetch.mock.calls[0][0])).toBe("http://localhost:8080/api/v1/orders?page=0&size=10");
});
