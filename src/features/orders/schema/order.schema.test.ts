import { describe, expect, it } from "vitest";

import { OrderSchema } from "./order.schema";

describe("OrderSchema legacy payloads", () => {
	it("defaults missing shipping fields and GHN order code to null", () => {
		const parsed = OrderSchema.parse({
			orderId: "ORD_1",
			customerId: "CUS_1",
			customerName: "Jane",
			status: "CONFIRMED",
			total: 100000,
			address: "12 Le Loi",
			recipientName: "Jane",
			phone: "0900000000",
			items: [],
			createdAt: "2026-01-01T00:00:00Z",
			updatedAt: "2026-01-01T00:00:00Z",
		});

		expect(parsed.shippingProvince).toBeNull();
		expect(parsed.shippingWard).toBeNull();
		expect(parsed.ghnOrderCode).toBeNull();
		expect(parsed).toMatchObject({ paymentExpiresAt: null, cancellationReason: null });
	});
});

const legacyOrder = {
	orderId: "ORD_1", customerId: "CUS_1", customerName: "Jane",
	status: "PENDING", total: 10000, address: "12 Le Loi",
	recipientName: "Jane", phone: "0900000000", items: [],
	createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z",
};

it.each(["STAFF_REJECTED", "PAYMENT_EXPIRED", "PAYMENT_FAILED"])(
	"retains the ISO instant and backend reason %s",
	(cancellationReason) => {
		expect(OrderSchema.parse({
			...legacyOrder, paymentExpiresAt: "2026-11-11T10:15:00.123456789Z",
			cancellationReason,
		})).toMatchObject({
			paymentExpiresAt: "2026-11-11T10:15:00.123456789Z", cancellationReason,
		});
	},
);

it.each(["not-a-date", "2026-02-30T10:15:00Z", "2026-11-11", "2026-11-11T10:15:00", 123])(
	"rejects malformed deadline %s",
	(paymentExpiresAt) => {
		expect(OrderSchema.safeParse({ ...legacyOrder, paymentExpiresAt }).success).toBe(false);
	},
);

it.each(["EXPIRED", "", 123])("rejects malformed cancellation reason %s", (cancellationReason) => {
	expect(OrderSchema.safeParse({ ...legacyOrder, cancellationReason }).success).toBe(false);
});

it("retains explicit null facts", () => {
	expect(OrderSchema.parse({
		...legacyOrder, paymentExpiresAt: null, cancellationReason: null,
	})).toMatchObject({ paymentExpiresAt: null, cancellationReason: null });
});
