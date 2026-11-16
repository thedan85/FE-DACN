import { expect, it } from "vitest";

import { OrderSchema } from "../../schema/order.schema";
import { canPayNow, orderFact } from "./order-display";

function order(facts = {}) {
	return OrderSchema.parse({
		orderId: "ORD_1", customerId: "CUS_1", customerName: "Jane",
		status: "PENDING", total: 10000, address: "12 Le Loi",
		recipientName: "Jane", phone: "0900000000", items: [],
		createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z",
		payment: { method: "CREDIT_CARD", status: "PENDING", transactionId: null, paidAt: null },
		paymentExpiresAt: "2026-11-11T10:15:00Z",
		...facts,
	});
}

it("formats the persisted instant in explicit UTC without locally expiring a pending order", () => {
	const pending = order();
	expect(orderFact(pending)).toBe("Payment deadline: 11 Nov 2026, 10:15 UTC.");
	expect(pending.status).toBe("PENDING");
	expect(canPayNow(pending)).toBe(true);
});

it.each([
	{ paymentExpiresAt: null },
	{ payment: null },
	{ payment: { method: "COD", status: "PENDING", transactionId: null, paidAt: null } },
	{ payment: { method: "CREDIT_CARD", status: "CONFIRMED", transactionId: null, paidAt: null } },
	{ status: "CONFIRMED" },
	{ status: "COMPLETED" },
	{ status: "CANCELLED", cancellationReason: null },
])("does not fabricate facts for %j", (facts) => {
	expect(orderFact(order(facts))).toBeNull();
});

it.each([
	["PAYMENT_EXPIRED", "Cancellation reason: Payment deadline passed."],
	["STAFF_REJECTED", "Cancellation reason: The store could not accept this order."],
	["PAYMENT_FAILED", "Cancellation reason: Payment failed."],
])("shows cancellation fact %s only on a cancelled order", (cancellationReason, copy) => {
	expect(orderFact(order({ status: "CANCELLED", cancellationReason }))).toBe(copy);
	expect(orderFact(order({ paymentExpiresAt: null, cancellationReason }))).toBeNull();
});

it("falls back safely if an unparsed future reason reaches presentation", () => {
	const cancelled = order({ status: "CANCELLED" });
	// The runtime parser rejects future enum values; presentation still fails safely.
	Object.assign(cancelled, { cancellationReason: "FUTURE_REASON" });
	expect(orderFact(cancelled)).toBe("Cancellation reason unavailable.");
});
