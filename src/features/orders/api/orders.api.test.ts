import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { listOrders } from "./orders.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
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
