import { getAuthHeaders } from "@/features/auth/session";
import { ApiError, apiFetch } from "@/lib/api/client";
import { createApiResponseSchema } from "@/lib/api/schema";
import type { OrderStatus } from "@/types";

import { OrderPageSchema, OrderSchema } from "../../schema/order.schema";
import type { Order, OrderPage } from "../../types";

const orderPageResponseSchema = createApiResponseSchema(OrderPageSchema);
const orderResponseSchema = createApiResponseSchema(OrderSchema);

export type StaffOrderListQuery = {
	/** 0-based, matching Spring Data. */
	page: number;
	size: number;
	status?: OrderStatus;
	q?: string;
};

function parseOrder(payload: unknown): Order {
	const parsed = orderResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw new ApiError(
			"The order response did not match the expected contract.",
			500,
			payload,
		);
	}

	return parsed.data.data;
}

export async function listStaffOrders(
	query: StaffOrderListQuery,
): Promise<OrderPage> {
	const params = new URLSearchParams({
		page: String(query.page),
		size: String(query.size),
	});
	if (query.status) params.set("status", query.status);
	if (query.q) params.set("q", query.q);

	const payload = await apiFetch<unknown>(
		`staff/orders?${params.toString()}`,
		{ headers: getAuthHeaders() },
	);
	const parsed = orderPageResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw new ApiError(
			"The order list response did not match the expected contract.",
			500,
			payload,
		);
	}

	return parsed.data.data;
}

export async function updateStaffOrderStatus(
	orderId: string,
	status: Extract<OrderStatus, "CONFIRMED" | "CANCELLED">,
): Promise<Order> {
	const payload = await apiFetch<unknown>(
		`staff/orders/${encodeURIComponent(orderId)}/status`,
		{
			method: "PATCH",
			headers: getAuthHeaders(),
			body: JSON.stringify({ status }),
		},
	);

	return parseOrder(payload);
}

export async function completeOrder(orderId: string): Promise<Order> {
	const payload = await apiFetch<unknown>(
		`admin/orders/${encodeURIComponent(orderId)}/complete`,
		{
			method: "POST",
			headers: getAuthHeaders(),
		},
	);

	return parseOrder(payload);
}
