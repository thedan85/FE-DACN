import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { confirmStaffPayment, listStaffOrders } from "./staff-orders.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

it("lists the staff queue with page, size, status, and search", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const page = { content: [], page: 0, size: 20, totalElements: 34, totalPages: 2 };
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: page,
	})));
	vi.stubGlobal("fetch", fetch);

	const result = await listStaffOrders({
		page: 0, size: 20, status: "PENDING", q: "ORD 1",
	});

	expect(result).toEqual(page);
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(String(fetch.mock.calls[0][0])).toContain("staff/orders?page=0&size=20&status=PENDING&q=ORD+1");
});

it("omits absent filters", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const page = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: page,
	})));
	vi.stubGlobal("fetch", fetch);

	await listStaffOrders({ page: 0, size: 20 });

	expect(String(fetch.mock.calls[0][0])).toBe("http://localhost:8080/api/v1/staff/orders?page=0&size=20");
});

it("confirms a payment and keeps only the status", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const payment = {
		paymentId: "PAY_1",
		orderId: "ORD_1",
		method: "VIETQR",
		status: "REFUND_REQUIRED",
		amount: 150000,
		transactionId: "TXN_1",
		paidAt: "2026-11-13T00:00:00Z",
		createdAt: "2026-11-12T00:00:00Z",
		updatedAt: "2026-11-13T00:00:00Z",
	};
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: payment,
	})));
	vi.stubGlobal("fetch", fetch);

	const result = await confirmStaffPayment("ORD_1");

	expect(result).toEqual({ status: "REFUND_REQUIRED" });
	const [url, init] = fetch.mock.calls[0];
	expect(String(url)).toBe("http://localhost:8080/api/v1/staff/orders/ORD_1/payment/confirm");
	expect(init.method).toBe("POST");
});

it("rejects a malformed confirm response", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: { status: "NOPE" },
	})));
	vi.stubGlobal("fetch", fetch);

	await expect(confirmStaffPayment("ORD_1")).rejects.toBeInstanceOf(ApiError);
});
