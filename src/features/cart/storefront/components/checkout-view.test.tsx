import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

import { checkoutCart, createVnpayPaymentUrl } from "../../api/cart.api";
import { createVietQrPayment } from "@/features/payments/api/payments.api";
import type { Order } from "@/features/orders/types";
import type { Cart } from "../../types";
import { useCart } from "../hooks/use-cart";
import { CheckoutView } from "./checkout-view";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: replaceMock }),
}));
vi.mock("next/link", () => ({
	default: ({ href, children }: { href: string; children: ReactNode }) => (
		<a href={href}>{children}</a>
	),
}));
vi.mock("../hooks/use-cart", () => ({ useCart: vi.fn() }));
vi.mock("../../api/cart.api", () => ({
	checkoutCart: vi.fn(),
	createVnpayPaymentUrl: vi.fn(),
}));
vi.mock("@/features/shipping/hooks/use-ghn-address", () => ({
	useGhnAddress: () => ({
		provinces: [{ id: 1, name: "Hanoi" }],
		wards: [{ id: 2, name: "Ba Dinh" }],
		loadingProvinces: false,
		loadingWards: false,
		error: null,
		reload: vi.fn(),
	}),
}));
vi.mock("@/features/payments/api/payments.api", () => ({
	createVietQrPayment: vi.fn(),
}));

const cart: Cart = {
	cartId: "CART_1",
	customerId: "CUS_1",
	customerName: "Jane",
	items: [
		{
			cartItemId: "CI_1",
			cartId: "CART_1",
			variantId: "VAR_1",
			sku: "FISH-GUPPY",
			quantity: 1,
			price: 100000,
			lineTotal: 100000,
			productId: "PRD_1",
			productName: "Guppy",
			thumbnail: null,
			stock: 5,
			createdAt: "2026-11-06T00:00:00Z",
			updatedAt: "2026-11-06T00:00:00Z",
		},
	],
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
		recommendedTankLitres: 75,
	},
	totalQuantity: 1,
	totalAmount: 100000,
	createdAt: "2026-11-06T00:00:00Z",
	updatedAt: "2026-11-06T00:00:00Z",
};

const placedOrder: Order = {
	orderId: "ORD_QR",
	customerId: "CUS_1",
	customerName: "Jane",
	status: "PENDING",
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
	payment: null,
};

const payment = {
	qrUrl: "https://img.vietqr.io/image/VCB-123-compact2.png?amount=100000",
	bankId: "VCB",
	accountNo: "123",
	accountName: "AQUARIUM STORE",
	amount: 100000,
	addInfo: "ORD_QR",
};

async function flush() {
	await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
	useAuthStore.setState({
		user: {
			userId: "CUS_1",
			email: "jane@example.com",
			name: "Jane",
			phone: "0900000000",
			address: "12 Le Loi",
			roleCode: "customer",
			roleName: "Customer",
			permissions: [],
			hasPassword: true,
		},
		status: "authenticated",
	});
	vi.mocked(useCart).mockReturnValue({
		state: { status: "ready", cart },
		reload: vi.fn(),
		setCart: vi.fn(),
	});
	replaceMock.mockReset();
	vi.mocked(checkoutCart).mockReset().mockResolvedValue(placedOrder);
	vi.mocked(createVnpayPaymentUrl).mockReset().mockResolvedValue("https://sandbox.vnpay.vn/pay");
	vi.mocked(createVietQrPayment).mockReset().mockResolvedValue(payment);
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false,
		addListener() {},
		removeListener() {},
		addEventListener() {},
		removeEventListener() {},
	}));
	vi.stubGlobal("ResizeObserver", class {
		observe() {}
		unobserve() {}
		disconnect() {}
	});
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function renderCheckout() {
	render(
		<App>
			<CheckoutView />
		</App>,
	);
}

// Checkout validates province and ward, so every submit test must select both.
// The ward select stays disabled until the province select fires onChange.
async function selectAddress() {
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Province or city" }));
	fireEvent.click(await screen.findByTitle("Hanoi"));
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Ward or commune" }));
	fireEvent.click(await screen.findByTitle("Ba Dinh"));
}

it("renders the VietQR option", () => {
	renderCheckout();

	expect(
		screen.getByRole("radio", { name: /VietQR bank transfer/ }),
	).toBeTruthy();
});

it("creates a VietQR order and opens the QR modal once", async () => {
	renderCheckout();

	await selectAddress();
	fireEvent.click(screen.getByRole("radio", { name: /VietQR bank transfer/ }));
	fireEvent.click(screen.getByRole("button", { name: /Place Order/ }));

	await waitFor(() => expect(createVietQrPayment).toHaveBeenCalledOnce());
	expect(checkoutCart).toHaveBeenCalledOnce();
	expect(checkoutCart).toHaveBeenCalledWith(
		expect.objectContaining({ method: "VIETQR" }),
	);
	expect(createVietQrPayment).toHaveBeenCalledExactlyOnceWith("ORD_QR");
	expect(screen.getByText("Order ORD_QR placed. Scan the QR to pay.")).toBeTruthy();
	expect(screen.getByRole("link", { name: "View your orders" }).getAttribute("href")).toBe(
		"/account/orders",
	);
	expect(createVnpayPaymentUrl).not.toHaveBeenCalled();
});

it("keeps the alert after the QR modal closes", async () => {
	renderCheckout();

	await selectAddress();
	fireEvent.click(screen.getByRole("radio", { name: /VietQR bank transfer/ }));
	fireEvent.click(screen.getByRole("button", { name: /Place Order/ }));

	await waitFor(() => expect(createVietQrPayment).toHaveBeenCalledOnce());
	const closeButtons = screen.getAllByRole("button", { name: "Close" });
	const footerClose = closeButtons.find((button) => button.textContent === "Close");
	expect(footerClose).toBeTruthy();
	fireEvent.click(footerClose as HTMLElement);
	await flush();

	expect(screen.getByText("Order ORD_QR placed. Scan the QR to pay.")).toBeTruthy();
});

it("keeps COD on its redirect path", async () => {
	renderCheckout();

	await selectAddress();
	fireEvent.click(screen.getByRole("radio", { name: /COD/ }));
	fireEvent.click(screen.getByRole("button", { name: /Place Order/ }));
	await flush();

	expect(checkoutCart).toHaveBeenCalledWith(expect.objectContaining({ method: "COD" }));
	expect(replaceMock).toHaveBeenCalledWith("/account/orders");
	expect(createVietQrPayment).not.toHaveBeenCalled();
});

it("keeps VN Pay on its redirect path", async () => {
	renderCheckout();
	const assign = vi.fn();
	vi.stubGlobal("location", { ...window.location, assign });

	await selectAddress();
	fireEvent.click(screen.getByRole("button", { name: /Place Order/ }));
	await flush();

	expect(createVnpayPaymentUrl).toHaveBeenCalledWith("ORD_QR");
	expect(assign).toHaveBeenCalledWith("https://sandbox.vnpay.vn/pay");
	expect(createVietQrPayment).not.toHaveBeenCalled();
});
