import { PAYMENT_METHOD_LABELS } from "@/lib/constants/labels";
import type { OrderStatus } from "@/types";

import type { OrderPayment, PaymentStatus } from "../../types";

/** Design labels differ from the backend enum names. */
export const ORDER_STATUS_COPY: Record<OrderStatus, string> = {
	PENDING: "Pending",
	CONFIRMED: "Processing",
	SHIPPING: "Shipped",
	COMPLETED: "Delivered",
	CANCELLED: "Cancelled",
};

export const PAYMENT_STATUS_COPY: Record<PaymentStatus, string> = {
	PENDING: "Unpaid",
	CONFIRMED: "Paid",
	FAILED: "Failed",
	REFUNDED: "Refunded",
	REFUND_REQUIRED: "Refund required",
};

/** `CREDIT_CARD` is how the backend stores a VN Pay payment. */
export function paymentMethodLabel(method: OrderPayment["method"]): string {
	if (method === "CREDIT_CARD") {
		return "VN Pay";
	}

	if (method === "COD") {
		return "COD";
	}

	return PAYMENT_METHOD_LABELS[method];
}

export function paymentLabel(payment: OrderPayment | null): string {
	if (!payment) {
		return "Payment unavailable";
	}

	return `${paymentMethodLabel(payment.method)} · ${PAYMENT_STATUS_COPY[payment.status]}`;
}
