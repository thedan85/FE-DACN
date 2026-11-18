import { z } from "zod";

import { getAuthHeaders } from "@/features/auth/session";
import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import { createApiResponseSchema } from "@/lib/api/schema";
import type { OrderStatus } from "@/types";

import { OrderPageSchema, OrderSchema, PaymentStatusSchema } from "../../schema/order.schema";
import type { Order, OrderPage } from "../../types";

/**
 * Staff order API, verified against the backend `staff/orders` endpoints.
 * The confirm response is a full `PaymentResponse`; only `status` is kept
 * because callers branch on the refund state, not the payment details.
 */

const staffOrdersResponseSchema = createApiResponseSchema(OrderPageSchema);
const orderResponseSchema = createApiResponseSchema(OrderSchema);

export const ConfirmPaymentResultSchema = z.object({
	status: PaymentStatusSchema,
});

export type ConfirmPaymentResult = z.infer<typeof ConfirmPaymentResultSchema>;

const confirmPaymentResponseSchema = createApiResponseSchema(ConfirmPaymentResultSchema);

export type StaffOrderListQuery = {
	/** 0-based, matching Spring Data. */
	page: number;
	size: number;
	status?: OrderStatus;
	q?: string;
};

export async function listStaffOrders(
	query: StaffOrderListQuery,
): Promise<OrderPage> {
	const params = new URLSearchParams({
		page: String(query.page),
		size: String(query.size),
	});
	if (query.status) params.set("status", query.status);
	if (query.q) params.set("q", query.q);

	const payload = await apiFetch<unknown>(`staff/orders?${params.toString()}`, {
		headers: getAuthHeaders(),
	});

	return parseOrThrow(
		staffOrdersResponseSchema,
		payload,
		"The staff order list response",
	).data;
}

export async function confirmStaffPayment(
	orderId: string,
): Promise<ConfirmPaymentResult> {
	const payload = await apiFetch<unknown>(
		`staff/orders/${encodeURIComponent(orderId)}/payment/confirm`,
		{ method: "POST", headers: getAuthHeaders() },
	);

	return parseOrThrow(
		confirmPaymentResponseSchema,
		payload,
		"The staff payment confirm response",
	).data;
}

/**
 * Staff accept/reject. Only `CONFIRMED` and `CANCELLED` are accepted by the
 * backend; it serializes the decision against payment settlement and rejects
 * anything that is not a pending order.
 */
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

	return parseOrThrow(
		orderResponseSchema,
		payload,
		"The staff order update response",
	).data;
}

/**
 * Admin override: mark a non-terminal order completed without the shipping
 * flow. Requires the admin-only `order:complete` permission; the backend
 * rejects orders that are already cancelled or completed.
 */
export async function completeOrder(orderId: string): Promise<Order> {
	const payload = await apiFetch<unknown>(
		`admin/orders/${encodeURIComponent(orderId)}/complete`,
		{ method: "POST", headers: getAuthHeaders() },
	);

	return parseOrThrow(
		orderResponseSchema,
		payload,
		"The admin complete response",
	).data;
}

export type ShipOrderAddress = {
	address: string;
	province: string;
	ward: string;
};

const shipOrderResponseSchema = createApiResponseSchema(
	OrderSchema.extend({ ghnOrderCode: z.string().trim().min(1) }),
);

export async function shipStaffOrder(
	orderId: string,
	address?: ShipOrderAddress,
): Promise<Order> {
	const payload = await apiFetch<unknown>(
		`staff/orders/${encodeURIComponent(orderId)}/ship`,
		{
			method: "POST",
			headers: getAuthHeaders(),
			...(address ? { body: JSON.stringify(address) } : {}),
		},
	);

	return parseOrThrow(shipOrderResponseSchema, payload, "The GHN booking response").data;
}
