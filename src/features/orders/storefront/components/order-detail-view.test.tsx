import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

import { OrderDetailView } from "./order-detail-view";

vi.mock("@/features/auth/session", () => ({ getAuthHeaders: () => ({}) }));

const order = {
	orderId: "ORD_1", customerId: "CUS_1", customerName: "Jane",
	status: "PENDING", total: 10000, address: "12 Le Loi",
	recipientName: "Jane", phone: "0900000000",
	items: [{
		orderId: "ORD_1", variantId: "VAR_1", sku: "GUPPY", quantity: 1,
		unitPrice: 10000, productName: "Guppy", createdAt: "2026-11-11T10:00:00Z",
	}],
	createdAt: "2026-11-11T10:00:00Z", updatedAt: "2026-11-11T10:00:00Z",
	payment: { method: "CREDIT_CARD", status: "PENDING", transactionId: null, paidAt: null },
	paymentExpiresAt: "2026-11-11T10:15:00Z", cancellationReason: null,
};

beforeEach(() => {
	useAuthStore.setState({ status: "authenticated", hydrate: async () => {} });
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false, addListener() {}, removeListener() {},
		addEventListener() {}, removeEventListener() {},
	}));
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

function mount(facts = {}) {
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: { ...order, ...facts },
	})));
	vi.stubGlobal("fetch", fetch);
	render(<App><OrderDetailView orderId="ORD_1" /></App>);
	return fetch;
}

it("shows the persisted deadline with totals, navigation, and Pay Now without lifecycle requests", async () => {
	const fetch = mount();
	const deadline = await screen.findByText(/Payment deadline:/);
	expect(deadline.textContent).toContain("11 Nov 2026");
	expect(deadline.textContent).toContain("10:15");
	expect(deadline.textContent).toContain("UTC");
	expect(screen.getByText("Guppy")).toBeTruthy();
	expect(screen.getAllByText(/10[.,]000/).length).toBeGreaterThan(0);
	expect(screen.getByRole("link", { name: /Back to My Orders/ }).getAttribute("href")).toBe("/account/orders");
	expect(screen.getByRole("button", { name: "Pay Now" })).toBeTruthy();
	expect(screen.getByText("Unpaid")).toBeTruthy();
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(String(fetch.mock.calls[0][0])).toBe("http://localhost:8080/api/v1/orders/ORD_1");
});

it("shows the real Pay Now pause envelope without navigating or changing authoritative facts", async () => {
	const fetch = mount();
	const assign = vi.fn();
	vi.stubGlobal("location", { ...window.location, assign });
	const payNow = await screen.findByRole("button", { name: "Pay Now" });
	fetch.mockResolvedValueOnce(new Response(JSON.stringify({
		code: 409, message: "online payment is temporarily unavailable", data: null,
	}), { status: 409 }));
	fireEvent.click(payNow);
	expect(await screen.findByText("online payment is temporarily unavailable")).toBeTruthy();
	expect(screen.getByText("Unpaid")).toBeTruthy();
	expect(screen.getByText(/Payment deadline:/)).toBeTruthy();
	expect(screen.getByRole("link", { name: /Back to My Orders/ })).toBeTruthy();
	expect(fetch).toHaveBeenCalledTimes(2);
	expect(String(fetch.mock.calls[1][0])).toBe("http://localhost:8080/api/v1/payments/vnpay/ORD_1");
	expect(assign).not.toHaveBeenCalled();
});

it.each([
	["PAYMENT_EXPIRED", /payment deadline passed/i],
	["STAFF_REJECTED", /store could not accept/i],
	["PAYMENT_FAILED", /payment failed/i],
])("shows customer-facing cancellation reason %s", async (cancellationReason, copy) => {
	const fetch = mount({ status: "CANCELLED", cancellationReason });
	expect(await screen.findByText(copy)).toBeTruthy();
	expect(screen.queryByText(/Payment deadline:/)).toBeNull();
	expect(screen.queryByRole("button", { name: "Pay Now" })).toBeNull();
	expect(screen.getByText("Unpaid")).toBeTruthy();
	expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([
	{ payment: { ...order.payment, method: "COD" } },
	{ paymentExpiresAt: null },
	{ payment: null },
	{ status: "CONFIRMED" },
	{ status: "CANCELLED", cancellationReason: null },
])("renders no extra fact for COD, null, or nonpending payload %j", async (facts) => {
	mount(facts);
	await screen.findByText("Guppy");
	expect(screen.queryByText(/Payment deadline:|Cancellation reason:/)).toBeNull();
});
