import { getAuthHeaders } from "@/features/auth/session";
import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import { createApiResponseSchema } from "@/lib/api/schema";

import { PaymentVietQrSchema } from "../schema/payment.schema";
import type { PaymentVietQr } from "../schema/payment.schema";

const paymentVietQrResponseSchema = createApiResponseSchema(PaymentVietQrSchema);

/** Requests the VietQR payment details for one order. */
export async function createVietQrPayment(
	orderId: string,
): Promise<PaymentVietQr> {
	const payload = await apiFetch<unknown>(
		`payments/vietqr/${encodeURIComponent(orderId)}`,
		{ method: "POST", headers: getAuthHeaders() },
	);

	return parseOrThrow(
		paymentVietQrResponseSchema,
		payload,
		"The VietQR payment response",
	).data;
}
