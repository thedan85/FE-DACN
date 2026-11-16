import { describe, expect, it } from "vitest";

import type { OrderView } from "../../types";
import {
	canPayNow,
	canShowVietQr,
	paymentBadgeLabel,
	paymentMethodLabel,
} from "./order-display";

function orderWith(
	payment: OrderView["payment"],
	status: OrderView["status"] = "PENDING",
): OrderView {
	return {
		orderId: "ORD_1",
		customerId: "CUS_1",
		customerName: "Jane",
		status,
		total: 100000,
		address: "12 Le Loi",
		recipientName: "Jane",
		phone: "0900000000",
		shippingProvince: null,
		shippingWard: null,
		ghnOrderCode: null,
		items: [],
		createdAt: "2026-11-01T00:00:00Z",
		updatedAt: "2026-11-01T00:00:00Z",
		payment,
	};
}

const payment = (
	method: "CREDIT_CARD" | "VIETQR" | "COD",
	status: "PENDING" | "CONFIRMED" = "PENDING",
) => ({ method, status, transactionId: null, paidAt: null }) as const;

describe("order payment display rules", () => {
	it("shows Pay Now only for pending VN Pay payments", () => {
		expect(canPayNow(orderWith(payment("CREDIT_CARD")))).toBe(true);
		expect(canPayNow(orderWith(payment("VIETQR")))).toBe(false);
		expect(canPayNow(orderWith(payment("COD")))).toBe(false);
	});

	it("shows the QR action only for pending VietQR payments", () => {
		expect(canShowVietQr(orderWith(payment("VIETQR")))).toBe(true);
		expect(canShowVietQr(orderWith(payment("CREDIT_CARD")))).toBe(false);
		expect(canShowVietQr(orderWith(payment("VIETQR", "CONFIRMED")))).toBe(false);
		expect(canShowVietQr(orderWith(payment("VIETQR"), "CONFIRMED"))).toBe(false);
		expect(canShowVietQr(orderWith(null))).toBe(false);
	});

	it("labels the method and badge", () => {
		expect(paymentMethodLabel("VIETQR")).toBe("VietQR bank transfer");
		expect(paymentBadgeLabel(payment("VIETQR"))).toBe("QR");
		expect(paymentBadgeLabel(payment("CREDIT_CARD"))).toBe("VN");
		expect(paymentBadgeLabel(payment("COD"))).toBe("COD");
	});
});
