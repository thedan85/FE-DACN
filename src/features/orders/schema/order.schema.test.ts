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
	});
});
