import { getAuthHeaders } from "@/features/auth/session";
import { ApiError, apiFetch } from "@/lib/api/client";
import { createApiResponseSchema } from "@/lib/api/schema";

import { OrderPageSchema, OrderSchema } from "../schema/order.schema";
import type { OrderPage, OrderView } from "../types";

/**
 * Storefront order API, verified against the backend `OrderController`.
 *
 * `OrderResponse` already carries the item display fields (product name,
 * thumbnail, attributes) and the order payment, so one request per page is
 * enough. No follow-up enrichment requests are needed.
 *
 * shortcut: fetch every page (100 per request) so status/search/date filters
 * can run client-side. Revisit when the backend exposes customer-side filtering
 * or an order page can hold hundreds of rows.
 */

const ordersResponseSchema = createApiResponseSchema(OrderPageSchema);
const orderResponseSchema = createApiResponseSchema(OrderSchema);

async function fetchOrderPage(page: number, size: number): Promise<OrderPage> {
	const payload = await apiFetch<unknown>(
		`orders?page=${page}&size=${size}`,
		{ headers: getAuthHeaders() },
	);
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

export async function listOrders(): Promise<OrderView[]> {
	const pageSize = 100;
	const firstPage = await fetchOrderPage(0, pageSize);
	const remainingPages = await Promise.all(
		Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
			fetchOrderPage(index + 1, pageSize),
		),
	);

	return [firstPage, ...remainingPages]
		.flatMap((page) => page.content)
		.sort(
			(left, right) =>
				left.createdAt.localeCompare(right.createdAt) ||
				left.orderId.localeCompare(right.orderId),
		);
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
