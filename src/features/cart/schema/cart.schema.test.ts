import { describe, expect, it } from "vitest";

import { CartDetailSchema } from "./cart.schema";

const base = {
	cartId: "CART_1",
	customerId: "CUS_1",
	customerName: "Jane",
	items: [],
	totalQuantity: 0,
	totalAmount: 0,
	createdAt: "2026-11-06T00:00:00Z",
	updatedAt: "2026-11-06T00:00:00Z",
};

describe("CartDetailSchema compatibility", () => {
	it("parses a caution verdict with checks", () => {
		const parsed = CartDetailSchema.parse({
			...base,
			compatibility: {
				verdict: "CAUTION",
				summary: "Some species need monitoring before cohabitation.",
				checks: [
					{
						code: "TEMPERATURE",
						status: "WARN",
						message: "Shared temperature range is only 24-26 °C.",
					},
				],
				recommendedTankLitres: 200,
			},
		});

		expect(parsed.compatibility?.verdict).toBe("CAUTION");
		expect(parsed.compatibility?.checks[0]?.status).toBe("WARN");
	});

	it("rejects an unknown verdict", () => {
		const parsed = CartDetailSchema.safeParse({
			...base,
			compatibility: {
				verdict: "MAYBE",
				summary: "",
				checks: [],
				recommendedTankLitres: null,
			},
		});

		expect(parsed.success).toBe(false);
	});

	it("accepts a missing compatibility field (older backend)", () => {
		// Older backend revisions omit `compatibility` entirely; the cart must
		// still parse so the rest of the page remains usable.
		expect(CartDetailSchema.safeParse(base).success).toBe(true);
	});
});
