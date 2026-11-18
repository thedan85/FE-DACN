import { PAYMENT_METHOD_LABELS } from "@/lib/constants/labels";
import type { OrderStatus } from "@/types";

import type { OrderPayment, OrderView, PaymentStatus } from "../../types";

export function orderFact(order: OrderView): string | null {
	if (order.status === "CANCELLED" && order.cancellationReason) {
		switch (order.cancellationReason) {
			case "STAFF_REJECTED":
				return "Cancellation reason: The store could not accept this order.";
			case "PAYMENT_EXPIRED":
				return "Cancellation reason: Payment deadline passed.";
			case "PAYMENT_FAILED":
				return "Cancellation reason: Payment failed.";
			default:
				return "Cancellation reason unavailable.";
		}
	}

	if (canPayNow(order) && order.paymentExpiresAt) {
		const deadline = new Intl.DateTimeFormat("en-GB", {
			day: "numeric", month: "short", year: "numeric",
			hour: "2-digit", minute: "2-digit", hour12: false,
			timeZone: "UTC", timeZoneName: "short",
		}).format(new Date(order.paymentExpiresAt));
		return `Payment deadline: ${deadline}.`;
	}

	return null;
}

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

/** Mirrors the backend rule: only a pending VN Pay payment can be paid again. */
export function canPayNow(order: OrderView): boolean {
	const payment = order.payment;

	return (
		order.status === "PENDING" &&
		payment !== null &&
		payment.status === "PENDING" &&
		payment.method === "CREDIT_CARD"
	);
}

/** A VietQR payment shows its QR action only while the order is still pending. */
export function canShowVietQr(order: OrderView): boolean {
	const payment = order.payment;

	return (
		order.status === "PENDING" &&
		payment !== null &&
		payment.status === "PENDING" &&
		payment.method === "VIETQR"
	);
}

export function paymentBadgeLabel(payment: OrderPayment): string {
	if (payment.method === "CREDIT_CARD") {
		return "VN";
	}

	if (payment.method === "VIETQR") {
		return "QR";
	}

	if (payment.method === "COD") {
		return "COD";
	}

	return "PAY";
}
