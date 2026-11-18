import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { completeOrder, confirmStaffPayment, listStaffOrders, shipStaffOrder, updateStaffOrderStatus } from "./staff-orders.api";

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

const bookedOrder = {
	orderId: "ORD_1",
	customerId: "CUS_1",
	customerName: "Jane",
	status: "CONFIRMED",
	total: 100000,
	address: "12 Le Loi",
	recipientName: "Jane",
	phone: "0900000000",
	shippingProvince: "Hồ Chí Minh",
	shippingWard: "Phường Sài Gòn",
	ghnOrderCode: "GHN123",
	items: [],
	createdAt: "2026-11-15T00:00:00Z",
	updatedAt: "2026-11-15T00:00:00Z",
	payment: {
		method: "COD",
		status: "PENDING",
		transactionId: null,
		paidAt: null,
	},
};

it("books GHN with the stored address and returns the confirmed order", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: bookedOrder,
	})));
	vi.stubGlobal("fetch", fetch);

	const result = await shipStaffOrder("ORD /1");

	expect(result.ghnOrderCode).toBe("GHN123");
	expect(result.status).toBe("CONFIRMED");
	const [url, init] = fetch.mock.calls[0];
	expect(String(url)).toBe("http://localhost:8080/api/v1/staff/orders/ORD%20%2F1/ship");
	expect(init.method).toBe("POST");
	expect(init.body).toBeUndefined();
	expect(init.headers.get("Authorization")).toBe("Bearer test-token");
});

it("sends address corrections as names in the ship body", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: bookedOrder,
	})));
	vi.stubGlobal("fetch", fetch);

	await shipStaffOrder("ORD_1", {
		address: "12 Le Loi", province: "Hồ Chí Minh", ward: "Phường Sài Gòn",
	});

	expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
		address: "12 Le Loi", province: "Hồ Chí Minh", ward: "Phường Sài Gòn",
	});
});

it("does not treat an order without a GHN code as a successful booking", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: { ...bookedOrder, ghnOrderCode: null },
	}))));

	await expect(shipStaffOrder("ORD_1")).rejects.toBeInstanceOf(ApiError);
});

it("surfaces a GHN failure without retrying the booking automatically", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 502, message: "GHN is not configured", data: null,
	}), { status: 502 }));
	vi.stubGlobal("fetch", fetch);

	await expect(shipStaffOrder("ORD_1")).rejects.toMatchObject({
		status: 502, message: "GHN is not configured",
	});
	expect(fetch).toHaveBeenCalledTimes(1);
});

const pendingOrder = {
	orderId: "ORD_1",
	customerId: "CUS_1",
	customerName: "Jane",
	status: "PENDING",
	total: 10000,
	address: "addr",
	recipientName: "Jane",
	phone: "090",
	items: [],
	createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z",
	payment: null,
};

it("accepts or rejects a staff order with a PATCH body", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: { ...pendingOrder, status: "CANCELLED" },
	})));
	vi.stubGlobal("fetch", fetch);

	const result = await updateStaffOrderStatus("ORD & 1", "CANCELLED");

	expect(result.status).toBe("CANCELLED");
	const [url, init] = fetch.mock.calls[0];
	expect(String(url)).toBe(
		"http://localhost:8080/api/v1/staff/orders/ORD%20%26%201/status",
	);
	expect(init.method).toBe("PATCH");
	expect(init.headers.get("Authorization")).toBe("Bearer test-token");
	expect(init.headers.get("Content-Type")).toBe("application/json");
	expect(init.body).toBe(JSON.stringify({ status: "CANCELLED" }));
});

it("completes an order through the admin override endpoint", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: { ...pendingOrder, status: "COMPLETED" },
	})));
	vi.stubGlobal("fetch", fetch);

	const result = await completeOrder("ORD/1");

	expect(result.status).toBe("COMPLETED");
	const [url, init] = fetch.mock.calls[0];
	expect(String(url)).toBe(
		"http://localhost:8080/api/v1/admin/orders/ORD%2F1/complete",
	);
	expect(init.method).toBe("POST");
	expect(init.headers.get("Authorization")).toBe("Bearer test-token");
});

it("rejects a malformed complete response", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: { ...pendingOrder, status: "NOT_A_STATUS" },
	})));
	vi.stubGlobal("fetch", fetch);

	await expect(completeOrder("ORD_1")).rejects.toBeInstanceOf(ApiError);
});
