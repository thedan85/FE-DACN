import { getAuthHeaders } from "@/features/auth/session";
import { ApiError, apiFetch } from "@/lib/api/client";
import { createApiResponseSchema } from "@/lib/api/schema";
import type { OrderStatus } from "@/types";

import { OrderPageSchema, OrderSchema } from "../schema/order.schema";
import type { OrderPage, OrderView } from "../types";

/**
 * Storefront order API, verified against the backend `OrderController`.
 *
 * `OrderResponse` already carries the item display fields (product name,
 * thumbnail, attributes) and the order payment, so one request per page is
 * enough. No follow-up enrichment requests are needed.
 */

const ordersResponseSchema = createApiResponseSchema(OrderPageSchema);
const orderResponseSchema = createApiResponseSchema(OrderSchema);

export type OrderListQuery = {
	/** 0-based, matching Spring Data. */
	page: number;
	size: number;
	status?: OrderStatus;
	q?: string;
	/** ISO-8601 instant, inclusive. */
	createdAfter?: string;
};

export async function listOrders(query: OrderListQuery): Promise<OrderPage> {
	const params = new URLSearchParams({
		page: String(query.page),
		size: String(query.size),
	});
	if (query.status) params.set("status", query.status);
	if (query.q) params.set("q", query.q);
	if (query.createdAfter) params.set("createdAfter", query.createdAfter);

	const payload = await apiFetch<unknown>(`orders?${params.toString()}`, {
		headers: getAuthHeaders(),
	});
	const parsed = ordersResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw new ApiError(
			"The order list response did not match the expected contract.",
			500,
			payload,
		);
	}

	return parsed.data.data;
}

export async function getOrder(orderId: string): Promise<OrderView> {
	const payload = await apiFetch<unknown>(
		`orders/${encodeURIComponent(orderId)}`,
		{ headers: getAuthHeaders() },
	);
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
