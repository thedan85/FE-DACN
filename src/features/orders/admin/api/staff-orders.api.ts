import { z } from "zod";

import { getAuthHeaders } from "@/features/auth/session";
import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import { createApiResponseSchema } from "@/lib/api/schema";
import type { OrderStatus } from "@/types";

import { OrderPageSchema, PaymentStatusSchema } from "../../schema/order.schema";
import type { OrderPage } from "../../types";

/**
 * Staff order API, verified against the backend `staff/orders` endpoints.
 * The confirm response is a full `PaymentResponse`; only `status` is kept
 * because callers branch on the refund state, not the payment details.
 */

const staffOrdersResponseSchema = createApiResponseSchema(OrderPageSchema);

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
