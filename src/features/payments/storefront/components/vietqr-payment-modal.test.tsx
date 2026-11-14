import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { formatVndPrice } from "@/features/products/storefront/model/product-format";
import { ApiError } from "@/lib/api/client";

import { createVietQrPayment } from "../../api/payments.api";
import { VietQrPaymentModal } from "./vietqr-payment-modal";

vi.mock("../../api/payments.api", () => ({ createVietQrPayment: vi.fn() }));

const payment = {
	qrUrl: "https://img.vietqr.io/image/VCB-123-compact2.png?amount=100000",
	bankId: "VCB",
	accountNo: "123",
	accountName: "AQUARIUM STORE",
	amount: 100000,
	addInfo: "ORD_1",
};

async function flush() {
	await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
	vi.mocked(createVietQrPayment).mockReset().mockResolvedValue(payment);
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false, addListener() {}, removeListener() {},
		addEventListener() {}, removeEventListener() {},
	}));
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function renderModal(open = true) {
	const onClose = vi.fn();
	const view = render(
		<App>
			<VietQrPaymentModal orderId="ORD_1" open={open} onClose={onClose} />
		</App>,
	);
	return { onClose, rerender: view.rerender };
}

it("fetches once per open and renders the QR and bank details", async () => {
	renderModal(true);

	await flush();

	expect(createVietQrPayment).toHaveBeenCalledTimes(1);
	expect(createVietQrPayment).toHaveBeenCalledWith("ORD_1");
	expect(screen.getByAltText("VietQR code for order ORD_1")).toBeTruthy();
	expect(
		screen.getByText((_, element) => element?.textContent === formatVndPrice(100000)),
	).toBeTruthy();
	expect(screen.getByText("VCB")).toBeTruthy();
	expect(screen.getByText("123")).toBeTruthy();
	expect(screen.getByText("AQUARIUM STORE")).toBeTruthy();
	expect(screen.getByText("ORD_1")).toBeTruthy();
});

it("does not fetch while closed", async () => {
	renderModal(false);

	await flush();

	expect(createVietQrPayment).not.toHaveBeenCalled();
});

it("does not fetch twice on rerender", async () => {
	const modal = renderModal(true);

	await flush();
	modal.rerender(
		<App>
			<VietQrPaymentModal orderId="ORD_1" open={true} onClose={modal.onClose} />
		</App>,
	);
	await flush();

	expect(createVietQrPayment).toHaveBeenCalledTimes(1);
});

it("fetches once per open transition", async () => {
	const modal = renderModal(true);

	await flush();
	modal.rerender(
		<App>
			<VietQrPaymentModal orderId="ORD_1" open={false} onClose={modal.onClose} />
		</App>,
	);
	expect(createVietQrPayment).toHaveBeenCalledTimes(1);

	modal.rerender(
		<App>
			<VietQrPaymentModal orderId="ORD_1" open={true} onClose={modal.onClose} />
		</App>,
	);
	await flush();

	expect(createVietQrPayment).toHaveBeenCalledTimes(2);
	expect(createVietQrPayment).toHaveBeenNthCalledWith(2, "ORD_1");
});

it.each([
	[503, "VietQR is not configured. Contact the shop."],
	[400, "This order is no longer awaiting VietQR payment. Refresh your order history to see its current status."],
	[404, "Order or payment not found."],
])("maps terminal error %i to a non-retryable message", async (status, expected) => {
	vi.mocked(createVietQrPayment).mockRejectedValue(new ApiError("backend message", status));
	renderModal(true);

	await flush();

	expect(screen.getByText(expected)).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
});

it("maps other 4xx errors to a normalized non-retryable message", async () => {
	vi.mocked(createVietQrPayment).mockRejectedValue(new ApiError("teapot", 418));
	renderModal(true);

	await flush();

	expect(screen.getByText("teapot")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
});

it("retries a network failure", async () => {
	vi.mocked(createVietQrPayment).mockRejectedValueOnce(new ApiError("offline", 0));
	renderModal(true);

	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Retry" }));
	await flush();

	expect(createVietQrPayment).toHaveBeenCalledTimes(2);
	expect(screen.getByAltText("VietQR code for order ORD_1")).toBeTruthy();
});

it("retries other 5xx failures", async () => {
	vi.mocked(createVietQrPayment).mockRejectedValueOnce(new ApiError("boom", 500));
	renderModal(true);

	await flush();

	expect(screen.getByText("boom")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Retry" }));
	await flush();

	expect(createVietQrPayment).toHaveBeenCalledTimes(2);
	expect(screen.getByAltText("VietQR code for order ORD_1")).toBeTruthy();
});

it("keeps bank details when the image fails", async () => {
	renderModal(true);

	await flush();
	fireEvent.error(screen.getByAltText("VietQR code for order ORD_1"));

	expect(screen.getByText("QR image could not load.")).toBeTruthy();
	expect(screen.getByText("VCB")).toBeTruthy();
	expect(screen.getByText("123")).toBeTruthy();
	expect(screen.getByText("AQUARIUM STORE")).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: "Retry image" }));

	expect(screen.getByAltText("VietQR code for order ORD_1")).toBeTruthy();
	expect(createVietQrPayment).toHaveBeenCalledTimes(1);
});
