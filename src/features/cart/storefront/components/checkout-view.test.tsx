import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

import { reconcileStock } from "@/features/stock/reconcile";
import { stockInterestKey, useStockSnapshots } from "@/features/stock/use-stock-snapshots";
import type { StockSnapshotState } from "@/features/stock/schema";
import * as cartApi from "../../api/cart.api";
import { CartDetailSchema } from "../../schema/cart.schema";
import { useCart } from "../hooks/use-cart";
import { CheckoutView } from "./checkout-view";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/auth/session", async (importOriginal) => ({
	...await importOriginal<typeof import("@/features/auth/session")>(),
	getAuthHeaders: () => ({}),
}));
vi.mock("@/features/stock/reconcile", () => ({ reconcileStock: vi.fn() }));
vi.mock("@/features/stock/use-stock-snapshots", async (importOriginal) => ({
	...await importOriginal<typeof import("@/features/stock/use-stock-snapshots")>(),
	useStockSnapshots: vi.fn(() => new Map()),
}));
vi.mock("../hooks/use-cart", () => ({ useCart: vi.fn() }));
vi.mock("@/features/shipping/hooks/use-ghn-address", () => ({
	useGhnAddress: () => ({
		provinces: [{ id: 1, name: "Test City" }], wards: [{ id: 2, name: "Test Ward" }],
		loadingProvinces: false, loadingWards: false, error: null, reload: vi.fn(),
	}),
}));

const cart = CartDetailSchema.parse({
	cartId: "CART_1", customerId: "CUS_1", customerName: "Jane",
	items: [{
		cartItemId: "CI_1", cartId: "CART_1", variantId: "VAR_1", sku: "GUPPY",
		productId: "PRD_1", productName: "Guppy", quantity: 1,
		price: 10000, lineTotal: 10000, stock: 5, thumbnail: null,
		createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z",
	}],
	totalQuantity: 1, totalAmount: 10000,
	createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z",
});
const order = {
	orderId: "ORD_1", customerId: "CUS_1", customerName: "Jane",
	status: "PENDING", total: 10000, address: "12 Le Loi",
	recipientName: "Jane", phone: "0900000000", items: [],
	createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z",
	payment: { method: "CREDIT_CARD", status: "PENDING", transactionId: null, paidAt: null },
	paymentExpiresAt: "2026-11-11T10:15:00Z", cancellationReason: null,
};
const reload = vi.fn();
const setCart = vi.fn();
const refresh = vi.fn();
const assign = vi.fn();
let pauseCheckout: boolean;
let malformedOrder: boolean;
const fetch = vi.fn();

function response(status: number, message: string, data: unknown) {
	return new Response(JSON.stringify({ code: status, message, data }), { status });
}

beforeEach(() => {
	pauseCheckout = true;
	malformedOrder = false;
	replace.mockReset();
	reload.mockReset();
	setCart.mockReset();
	refresh.mockReset();
	assign.mockReset();
	vi.spyOn(cartApi, "createVnpayPaymentUrl");
	fetch.mockReset().mockImplementation(async (url, init) => {
		const path = new URL(String(url)).pathname;
		if (path.endsWith("/cart/checkout")) {
			const input = JSON.parse(init.body);
			if (pauseCheckout && input.method !== "COD") {
				return response(409, "online checkout is temporarily unavailable", null);
			}
			return response(200, "OK", {
				...order, payment: { ...order.payment, method: input.method },
				paymentExpiresAt: malformedOrder ? "not-a-date" : input.method === "COD" ? null : order.paymentExpiresAt,
			});
		}
		if (path.endsWith("/payments/vnpay/ORD_1")) {
			return response(409, "online payment is temporarily unavailable", null);
		}
		throw new Error(`Unexpected request: ${path}`);
	});
	vi.stubGlobal("fetch", fetch);
	vi.stubGlobal("location", { ...window.location, assign });
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	useAuthStore.setState({ status: "authenticated", user: null });
	vi.mocked(reconcileStock).mockReset();
	vi.mocked(useStockSnapshots).mockReturnValue(new Map());
	vi.mocked(useCart).mockReturnValue({
		state: { status: "ready", cart }, reload, setCart, refresh,
	});
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false, addListener() {}, removeListener() {},
		addEventListener() {}, removeEventListener() {},
	}));
	vi.stubGlobal("ResizeObserver", class {
		observe() {}
		unobserve() {}
		disconnect() {}
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

async function fillForm() {
	render(<App><CheckoutView /></App>);
	fireEvent.change(screen.getByLabelText("Recipient Name"), { target: { value: "Jane Edited" } });
	fireEvent.change(screen.getByLabelText("Phone Number"), { target: { value: "0900000000" } });
	fireEvent.change(screen.getByLabelText("Street Address"), { target: { value: "12 Le Loi" } });
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Province or city" }));
	fireEvent.click(await screen.findByText("Test City", { selector: ".ant-select-item-option-content" }));
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Ward or commune" }));
	fireEvent.click(await screen.findByText("Test Ward", { selector: ".ant-select-item-option-content" }));
}

function expectFormPreserved() {
	expect((screen.getByLabelText("Recipient Name") as HTMLInputElement).value).toBe("Jane Edited");
	expect((screen.getByLabelText("Phone Number") as HTMLInputElement).value).toBe("0900000000");
	expect((screen.getByLabelText("Street Address") as HTMLTextAreaElement).value).toBe("12 Le Loi");
	expect(screen.getByRole("combobox", { name: "Province or city" }).closest("[title]")?.getAttribute("title")).toBe("Test City");
	expect(screen.getByRole("combobox", { name: "Ward or commune" }).closest("[title]")?.getAttribute("title")).toBe("Test Ward");
	expect((screen.getByRole("radio", { name: /VN Pay/ }) as HTMLInputElement).checked).toBe(true);
	expect(screen.getByText("Guppy")).toBeTruthy();
	expect(reload).not.toHaveBeenCalled();
	expect(setCart).not.toHaveBeenCalled();
}

it("preserves the online checkout form and cart on the real pause conflict without requesting a URL", async () => {
	await fillForm();
	fireEvent.click(screen.getByRole("button", { name: /Place Order/ }));
	expect((await screen.findByRole("alert")).textContent).toContain("online checkout is temporarily unavailable");
	expectFormPreserved();
	expect(cartApi.createVnpayPaymentUrl).not.toHaveBeenCalled();
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(assign).not.toHaveBeenCalled();
	expect(replace).not.toHaveBeenCalled();
	expect((screen.getByRole("button", { name: /Place Order/ }) as HTMLButtonElement).disabled).toBe(false);
	// Rejection silently reconciles cart and stock without a loading screen,
	// even when the reconciliation fetch fails (a no-op refresh mock here).
	expect(refresh).toHaveBeenCalledTimes(1);
	expect(reconcileStock).toHaveBeenCalledTimes(1);
	expect(reload).not.toHaveBeenCalled();
	expect(screen.queryByText(/Loading checkout/)).toBeNull();
	expect(screen.queryByText(/Could not load your cart/)).toBeNull();
});

it("keeps the created order authoritative and shows temporary URL unavailability with the existing orders link", async () => {
	pauseCheckout = false;
	await fillForm();
	fireEvent.click(screen.getByRole("button", { name: /Place Order/ }));
	const alert = await screen.findByRole("alert");
	expect(alert.textContent).toContain("Order ORD_1 was created");
	expect(alert.textContent).toContain("online payment is temporarily unavailable");
	expect(screen.getByRole("link", { name: "View your orders" }).getAttribute("href")).toBe("/account/orders");
	expectFormPreserved();
	expect(cartApi.createVnpayPaymentUrl).toHaveBeenCalledExactlyOnceWith("ORD_1");
	expect(fetch).toHaveBeenCalledTimes(2);
	expect(assign).not.toHaveBeenCalled();
	expect(replace).not.toHaveBeenCalled();
	expect((screen.getByRole("button", { name: /Place Order/ }) as HTMLButtonElement).disabled).toBe(true);
	expect(screen.queryByText(/Paid|Cancelled|Expired/i)).toBeNull();
	// The cart was deleted by checkout: refreshing here would blank the page
	// and hide the order-created confirmation and its orders link.
	expect(refresh).not.toHaveBeenCalled();
	expect(reconcileStock).not.toHaveBeenCalled();
	expect(reload).not.toHaveBeenCalled();
	expect(screen.getByText("Order ORD_1 was created")).toBeTruthy();
	expect(screen.getByRole("link", { name: "View your orders" }).getAttribute("href")).toBe("/account/orders");
	fireEvent.click(screen.getByRole("button", { name: /Place Order/ }));
	expect(fetch).toHaveBeenCalledTimes(2);
});

it("still places COD with online work paused and never requests a URL", async () => {
	await fillForm();
	fireEvent.click(screen.getByRole("radio", { name: /Cash on Delivery/ }));
	fireEvent.click(screen.getByRole("button", { name: /Place Order/ }));
	await waitFor(() => expect(replace).toHaveBeenCalledWith("/account/orders"));
	expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
		recipientName: "Jane Edited", phone: "0900000000", address: "12 Le Loi",
		province: "Test City", ward: "Test Ward", method: "COD",
	});
	expect(cartApi.createVnpayPaymentUrl).not.toHaveBeenCalled();
	expect(assign).not.toHaveBeenCalled();
});

it("rejects malformed checkout facts through the real schema without requesting a payment URL", async () => {
	pauseCheckout = false;
	malformedOrder = true;
	await fillForm();
	fireEvent.click(screen.getByRole("button", { name: /Place Order/ }));
	expect((await screen.findByRole("alert")).textContent).toContain("did not match the expected contract");
	expect(cartApi.createVnpayPaymentUrl).not.toHaveBeenCalled();
	expect(assign).not.toHaveBeenCalled();
});

describe("CheckoutView live availability", () => {
	const lineKey = stockInterestKey({ kind: "variant", productId: "PRD_1", variantId: "VAR_1" });
	const live = (stock: number): StockSnapshotState => ({
		stock, stockRevision: 1, loading: false, error: null, omitted: false,
		readiness: { admission: "admitted", acknowledged: true, status: "live" },
	});

	it("warns and disables Place Order while live stock is below the line quantity", async () => {
		vi.mocked(useStockSnapshots).mockReturnValue(new Map([[lineKey, live(0)]]));
		await fillForm();
		const place = screen.getByRole("button", { name: /Place Order/ }) as HTMLButtonElement;
		expect(place.disabled).toBe(true);
		expect(screen.getByText(/Some items are no longer available/)).toBeTruthy();
		expectFormPreserved();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("keeps variant, quantity, address and payment choice across live updates", async () => {
		vi.mocked(useStockSnapshots).mockReturnValue(new Map([[lineKey, live(0)]]));
		await fillForm();
		fireEvent.click(screen.getByRole("radio", { name: /Cash on Delivery/ }));

		vi.mocked(useStockSnapshots).mockReturnValue(new Map([[lineKey, live(5)]]));
		// Rerender by triggering a harmless store-independent state change.
		fireEvent.change(screen.getByLabelText("Recipient Name"), { target: { value: "Jane Live" } });

		expect((screen.getByLabelText("Recipient Name") as HTMLInputElement).value).toBe("Jane Live");
		expect((screen.getByLabelText("Phone Number") as HTMLInputElement).value).toBe("0900000000");
		expect((screen.getByLabelText("Street Address") as HTMLTextAreaElement).value).toBe("12 Le Loi");
		expect((screen.getByRole("radio", { name: /Cash on Delivery/ }) as HTMLInputElement).checked).toBe(true);
		expect(screen.getByText(/1 ×/)).toBeTruthy(); // line quantity text unchanged
		expect(screen.getByText("Guppy")).toBeTruthy(); // selected line/variant unchanged
		expect((screen.getByRole("button", { name: /Place Order/ }) as HTMLButtonElement).disabled).toBe(false);
		expect(refresh).not.toHaveBeenCalled();
		expect(reconcileStock).not.toHaveBeenCalled();
	});
});
