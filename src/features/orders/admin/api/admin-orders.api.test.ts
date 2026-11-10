import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import {
	completeOrder,
	listStaffOrders,
	updateStaffOrderStatus,
} from "./admin-orders.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer admin-token" }),
}));

const order = {
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

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

function stubFetch(data: unknown) {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(
		new Response(JSON.stringify({ code: 200, message: "OK", data })),
	);
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

it("lists staff orders with encoded filters and auth", async () => {
	const fetch = stubFetch({
		content: [order],
		page: 1,
		size: 20,
		totalElements: 21,
		totalPages: 2,
	});

	const result = await listStaffOrders({
		page: 1,
		size: 20,
		status: "PENDING",
		q: "Jane & 090",
	});

	expect(result.content).toHaveLength(1);
	const [url, init] = fetch.mock.calls[0];
	expect(String(url)).toBe(
		"http://localhost:8080/api/v1/staff/orders?page=1&size=20&status=PENDING&q=Jane+%26+090",
	);
	expect(init.headers.get("Authorization")).toBe("Bearer admin-token");
});

it("accepts or rejects a staff order with a PATCH body", async () => {
	const fetch = stubFetch({ ...order, status: "CANCELLED" });

	const result = await updateStaffOrderStatus("ORD & 1", "CANCELLED");

	expect(result.status).toBe("CANCELLED");
	const [url, init] = fetch.mock.calls[0];
	expect(String(url)).toBe(
		"http://localhost:8080/api/v1/staff/orders/ORD%20%26%201/status",
	);
	expect(init.method).toBe("PATCH");
	expect(init.headers.get("Authorization")).toBe("Bearer admin-token");
	expect(init.headers.get("Content-Type")).toBe("application/json");
	expect(init.body).toBe(JSON.stringify({ status: "CANCELLED" }));
});

it("completes an order through the admin override endpoint", async () => {
	const fetch = stubFetch({ ...order, status: "COMPLETED" });

	const result = await completeOrder("ORD/1");

	expect(result.status).toBe("COMPLETED");
	const [url, init] = fetch.mock.calls[0];
	expect(String(url)).toBe(
		"http://localhost:8080/api/v1/admin/orders/ORD%2F1/complete",
	);
	expect(init.method).toBe("POST");
	expect(init.headers.get("Authorization")).toBe("Bearer admin-token");
});

it("rejects a malformed order response", async () => {
	stubFetch({ ...order, status: "NOT_A_STATUS" });

	await expect(completeOrder("ORD_1")).rejects.toBeInstanceOf(ApiError);
});
