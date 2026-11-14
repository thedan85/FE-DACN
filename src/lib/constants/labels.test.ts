import { describe, expect, it } from "vitest";

import { PaymentMethodSchema } from "@/lib/api/schema";

import { PAYMENT_METHOD_LABELS } from "./labels";

describe("payment method labels", () => {
	it("accepts the backend VIETQR method", () => {
		expect(PaymentMethodSchema.parse("VIETQR")).toBe("VIETQR");
	});

	it("labels every payment method", () => {
		for (const method of PaymentMethodSchema.options) {
			expect(PAYMENT_METHOD_LABELS[method]).toBeTruthy();
		}
	});
});
