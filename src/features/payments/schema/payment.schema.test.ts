import { describe, expect, it } from "vitest";

import { PaymentVietQrSchema } from "./payment.schema";

const valid = {
	qrUrl: "https://img.vietqr.io/image/VCB-123-compact2.png?amount=100000",
	bankId: "VCB",
	accountNo: "123",
	accountName: "AQUARIUM STORE",
	amount: 100000,
	addInfo: "ORD_1",
};

describe("PaymentVietQrSchema", () => {
	it("accepts the backend response", () => {
		expect(PaymentVietQrSchema.parse(valid)).toEqual(valid);
	});

	it("rejects a non-URL qrUrl", () => {
		expect(PaymentVietQrSchema.safeParse({ ...valid, qrUrl: "QR_1" }).success).toBe(false);
	});
});
