import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

import { addToCart, createVnpayPaymentUrl } from "@/features/cart/api/cart.api";
import { listOrders } from "../../api/orders.api";
import type { OrderPage, OrderView } from "../../types";
import { OrderSchema } from "../../schema/order.schema";
import { OrderHistoryView } from "./order-history-view";

vi.mock("@/features/payments/storefront/components/vietqr-payment-modal", () => ({
	VietQrPaymentModal: ({
		orderId,
		open,
		onClose,
	}: {
		orderId: string | null;
		open: boolean;
		onClose: () => void;
	}) =>
		open ? (
			<div>
				<p>QR modal for {orderId}</p>
				<button type="button" onClick={onClose}>Close QR</button>
			</div>
		) : null,
}));
vi.mock("../../api/orders.api", () => ({ listOrders: vi.fn() }));
vi.mock("@/features/cart/api/cart.api", () => ({
	addToCart: vi.fn(),
	createVnpayPaymentUrl: vi.fn(),
}));

const order: OrderView = {
	orderId: "ORD_NEWEST", customerId: "CUS_1", customerName: "Jane",
	status: "CONFIRMED", total: 10000, address: "addr", recipientName: "Jane",
	phone: "090", shippingProvince: null, shippingWard: null, ghnOrderCode: null,
	items: [], createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z", payment: null,
	paymentExpiresAt: null, cancellationReason: null,
};

function page(orderId = "ORD_NEWEST", pageNumber = 0): OrderPage {
	return { content: [{ ...order, orderId }], page: pageNumber, size: 10,
		totalElements: 21, totalPages: 3 };
}

async function flush() {
	await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.mocked(listOrders).mockReset().mockResolvedValue(page());
	useAuthStore.setState({ status: "authenticated", hydrate: async () => {} });
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false, addListener() {}, removeListener() {},
		addEventListener() {}, removeEventListener() {},
	}));
});

it("shows a pending online deadline without issuing payment or changing the order", async () => {
	const pending = OrderSchema.parse({
		...order, status: "PENDING", paymentExpiresAt: "2026-11-11T10:15:00Z",
		payment: { method: "CREDIT_CARD", status: "PENDING", transactionId: null, paidAt: null },
	});
	vi.mocked(listOrders).mockResolvedValue({ ...page(), content: [pending] });
	vi.mocked(createVnpayPaymentUrl).mockClear();
	await mount();
	expect(screen.getByText(/Payment deadline:/).textContent).toContain("11 Nov 2026");
	expect(screen.getByText(/Payment deadline:/).textContent).toContain("10:15");
	expect(screen.getByRole("button", { name: "Pay Now" })).toBeTruthy();
	expect(screen.getByRole("link", { name: "View Details" }).getAttribute("href")).toBe("/account/orders/ORD_NEWEST");
	expect(screen.getByText(/10[.,]000/)).toBeTruthy();
	expect(createVnpayPaymentUrl).not.toHaveBeenCalled();
	expect(listOrders).toHaveBeenCalledTimes(1);
	expect(pending.status).toBe("PENDING");
});

it.each(["PAYMENT_EXPIRED", "STAFF_REJECTED", "PAYMENT_FAILED"])(
	"shows cancelled order reason %s",
	async (cancellationReason) => {
		const cancelled = OrderSchema.parse({ ...order, status: "CANCELLED", cancellationReason });
		vi.mocked(listOrders).mockResolvedValue({ ...page(), content: [cancelled] });
		await mount();
		expect(screen.getByText(/Cancellation reason:/)).toBeTruthy();
		expect(screen.getByRole("link", { name: "View Details" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Pay Now" })).toBeNull();
	},
);

it.each([
	{ status: "PENDING", payment: { method: "COD", status: "PENDING", transactionId: null, paidAt: null }, paymentExpiresAt: "2026-11-11T10:15:00Z" },
	{ status: "PENDING", paymentExpiresAt: null },
	{ status: "CANCELLED", cancellationReason: null },
])("does not invent extra order facts for %j", async (facts) => {
	vi.mocked(listOrders).mockResolvedValue({
		...page(), content: [OrderSchema.parse({ ...order, ...facts })],
	});
	await mount();
	expect(screen.queryByText(/Payment deadline:|Cancellation reason:/)).toBeNull();
});

it("preserves completed-order buy-again items, quantities, total, and route", async () => {
	const completed = OrderSchema.parse({
		...order, status: "COMPLETED",
		items: [{
			orderId: order.orderId, variantId: "VAR_1", sku: "GUPPY",
			quantity: 2, unitPrice: 5000, createdAt: order.createdAt,
		}],
	});
	vi.mocked(listOrders).mockResolvedValue({ ...page(), content: [completed] });
	vi.mocked(addToCart).mockResolvedValue({ status: "auth-required" });
	await mount();
	expect(screen.getByText(/10[.,]000/)).toBeTruthy();
	expect(screen.getByRole("link", { name: "View Details" }).getAttribute("href")).toBe("/account/orders/ORD_NEWEST");
	fireEvent.click(screen.getByRole("button", { name: "Buy Again" }));
	await flush();
	expect(addToCart).toHaveBeenCalledExactlyOnceWith({ variantId: "VAR_1", quantity: 2 });
	expect(screen.getByText("Please sign in again to add these items to your cart.")).toBeTruthy();
	expect(screen.getByRole("button", { name: "Buy Again" })).toBeTruthy();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

async function mount() {
	render(<App><OrderHistoryView /></App>);
	await flush();
}

it("renders server totals and requests the next zero-based page", async () => {
	await mount();
	expect(listOrders).toHaveBeenLastCalledWith({ page: 0, size: 10 });
	expect(screen.getByText("21 orders")).toBeTruthy();
	expect(screen.getByText("Newest first")).toBeTruthy();
	fireEvent.click(screen.getByTitle("2"));
	await flush();
	expect(listOrders).toHaveBeenLastCalledWith({ page: 1, size: 10 });
});

it("resets status and date filters to page zero without an intermediate stale-page request", async () => {
	await mount();
	fireEvent.click(screen.getByTitle("3"));
	await flush();
	vi.mocked(listOrders).mockClear();
	fireEvent.click(screen.getByRole("button", { name: "Processing" }));
	await flush();
	expect(listOrders).toHaveBeenCalledExactlyOnceWith({ page: 0, size: 10, status: "CONFIRMED" });
	fireEvent.click(screen.getByTitle("3"));
	await flush();
	vi.mocked(listOrders).mockClear();
	fireEvent.change(screen.getByLabelText("Filter orders by date"), { target: { value: "7" } });
	await flush();
	expect(listOrders).toHaveBeenCalledExactlyOnceWith({
		page: 0, size: 10, status: "CONFIRMED", createdAfter: expect.any(String),
	});
});

it("debounces and trims order-ID search then resets the page", async () => {
	await mount();
	fireEvent.click(screen.getByTitle("3"));
	await flush();
	vi.mocked(listOrders).mockClear();
	fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  beta  " } });
	await act(async () => { vi.advanceTimersByTime(299); });
	expect(listOrders).not.toHaveBeenCalled();
	await act(async () => { vi.advanceTimersByTime(1); });
	await flush();
	expect(listOrders).toHaveBeenCalledExactlyOnceWith({ page: 0, size: 10, q: "beta" });
});

it("keeps an oversized search editable until corrected without requesting it", async () => {
	await mount();
	fireEvent.click(screen.getByTitle("3"));
	await flush();
	vi.mocked(listOrders).mockClear().mockImplementation(async ({ q, page: pageNumber }) => {
		if (q && q.length > 100) throw new ApiError("Order search is too long", 400);
		return page(q === "ORD_FIXED" ? "ORD_FIXED" : "ORD_NEWEST", pageNumber);
	});
	const search = screen.getByRole("searchbox");
	fireEvent.change(search, { target: { value: "x".repeat(101) } });
	await act(async () => { vi.advanceTimersByTime(300); });
	await flush();

	expect(screen.getByRole("searchbox")).toBe(search);
	expect(search.getAttribute("aria-invalid")).toBe("true");
	const error = screen.getByRole("alert");
	expect(error.textContent).toContain("100");
	expect(search.getAttribute("aria-describedby")).toBe(error.id);
	expect(screen.getByText("#ORD_NEWEST")).toBeTruthy();
	expect(listOrders).not.toHaveBeenCalled();

	fireEvent.change(search, { target: { value: "  ORD_FIXED  " } });
	await act(async () => { vi.advanceTimersByTime(300); });
	await flush();
	expect(listOrders).toHaveBeenCalledExactlyOnceWith({ page: 0, size: 10, q: "ORD_FIXED" });
	expect(screen.getByText("#ORD_FIXED")).toBeTruthy();
	expect(screen.queryByRole("alert")).toBeNull();
	expect(search.getAttribute("aria-invalid")).not.toBe("true");
});

it("accepts a 100-character order-ID search after trimming", async () => {
	await mount();
	vi.mocked(listOrders).mockClear();
	fireEvent.change(screen.getByRole("searchbox"), {
		target: { value: `  ${"x".repeat(100)}  ` },
	});
	await act(async () => { vi.advanceTimersByTime(300); });
	await flush();
	expect(listOrders).toHaveBeenCalledExactlyOnceWith({ page: 0, size: 10, q: "x".repeat(100) });
	expect(screen.queryByRole("alert")).toBeNull();
});

it("ignores an older response while keeping the previous list visible during fetch", async () => {
	await mount();
	let resolveOld!: (value: OrderPage) => void;
	vi.mocked(listOrders).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
	fireEvent.click(screen.getByTitle("2"));
	expect(screen.getByText("#ORD_NEWEST")).toBeTruthy();
	expect(screen.getByText("#ORD_NEWEST").closest("[aria-busy]")?.getAttribute("aria-busy")).toBe("true");
	vi.mocked(listOrders).mockResolvedValueOnce(page("ORD_FILTERED"));
	fireEvent.click(screen.getByRole("button", { name: "Pending" }));
	await flush();
	await act(async () => { resolveOld(page("ORD_STALE", 1)); });
	expect(screen.getByText("#ORD_FILTERED")).toBeTruthy();
	expect(screen.queryByText("#ORD_STALE")).toBeNull();
});

it("does not reset a selected page when the initial empty-search timer expires", async () => {
	await mount();
	fireEvent.click(screen.getByTitle("3"));
	await flush();
	vi.mocked(listOrders).mockClear();
	await act(async () => { vi.advanceTimersByTime(300); });
	expect(listOrders).not.toHaveBeenCalled();
});

it("keeps the selected date cutoff stable across page requests", async () => {
	await mount();
	fireEvent.change(screen.getByLabelText("Filter orders by date"), { target: { value: "7" } });
	await flush();
	const cutoff = vi.mocked(listOrders).mock.calls.at(-1)?.[0].createdAfter;
	await act(async () => { vi.advanceTimersByTime(120000); });
	fireEvent.click(screen.getByTitle("2"));
	await flush();
	expect(vi.mocked(listOrders).mock.calls.at(-1)?.[0].createdAfter).toBe(cutoff);
});

it("keeps controls visible while clearing a filtered-empty result", async () => {
	await mount();
	vi.mocked(listOrders).mockResolvedValueOnce({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 });
	fireEvent.click(screen.getByRole("button", { name: "Pending" }));
	await flush();
	vi.mocked(listOrders).mockImplementationOnce(() => new Promise(() => {}));
	fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
	expect(screen.queryByText("No orders yet")).toBeNull();
	expect(screen.getByRole("searchbox")).toBeTruthy();
});

it("recovers to the last available page when totals shrink", async () => {
	await mount();
	vi.mocked(listOrders)
		.mockResolvedValueOnce({ content: [], page: 2, size: 10, totalElements: 10, totalPages: 1 })
		.mockResolvedValueOnce({ ...page("ORD_REMAINING"), totalElements: 10, totalPages: 1 });
	fireEvent.click(screen.getByTitle("3"));
	await flush();
	expect(listOrders).toHaveBeenLastCalledWith({ page: 0, size: 10 });
	expect(screen.getByText("#ORD_REMAINING")).toBeTruthy();
});

it("distinguishes filtered-empty from no history and clears filters", async () => {
	await mount();
	const empty: OrderPage = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 };
	vi.mocked(listOrders).mockResolvedValue(empty);
	fireEvent.click(screen.getByRole("button", { name: "Pending" }));
	await flush();
	expect(screen.getByText("No orders found")).toBeTruthy();
	expect(screen.queryByText("No orders yet")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
	await flush();
	expect(listOrders).toHaveBeenLastCalledWith({ page: 0, size: 10 });
	expect(screen.getByText("No orders yet")).toBeTruthy();
});

it("shows Pay Now for a pending VN Pay order and opens the payment page", async () => {
	const pending: OrderView = {
		...order,
		orderId: "ORD_PAY",
		status: "PENDING",
		payment: {
			method: "CREDIT_CARD",
			status: "PENDING",
			transactionId: null,
			paidAt: null,
		},
	};
	vi.mocked(listOrders).mockResolvedValue({
		content: [pending],
		page: 0,
		size: 10,
		totalElements: 1,
		totalPages: 1,
	});
	vi.mocked(createVnpayPaymentUrl).mockResolvedValue(
		"https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
	);
	const assign = vi.fn();
	vi.stubGlobal("location", { ...window.location, assign });

	await mount();
	fireEvent.click(screen.getByRole("button", { name: "Pay Now" }));
	await act(async () => { await Promise.resolve(); });

	expect(createVnpayPaymentUrl).toHaveBeenCalledWith("ORD_PAY");
	expect(assign).toHaveBeenCalledWith(
		"https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
	);
});

it("opens the QR modal and reloads the list when it closes", async () => {
	const vietQr: OrderView = {
		...order,
		orderId: "ORD_QR",
		status: "PENDING",
		payment: { method: "VIETQR", status: "PENDING", transactionId: null, paidAt: null },
	};
	vi.mocked(listOrders).mockResolvedValue({
		content: [vietQr], page: 0, size: 10, totalElements: 1, totalPages: 1,
	});

	await mount();
	expect(screen.queryByRole("button", { name: "Pay Now" })).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Show QR" }));
	expect(screen.getByText("QR modal for ORD_QR")).toBeTruthy();

	vi.mocked(listOrders).mockClear();
	fireEvent.click(screen.getByRole("button", { name: "Close QR" }));
	await flush();

	expect(listOrders).toHaveBeenCalledExactlyOnceWith({ page: 0, size: 10 });
});

it("does not show Show QR for a pending VN Pay order", async () => {
	const vnpay: OrderView = {
		...order,
		orderId: "ORD_PAY",
		status: "PENDING",
		payment: { method: "CREDIT_CARD", status: "PENDING", transactionId: null, paidAt: null },
	};
	vi.mocked(listOrders).mockResolvedValue({
		content: [vnpay], page: 0, size: 10, totalElements: 1, totalPages: 1,
	});

	await mount();

	expect(screen.queryByRole("button", { name: "Show QR" })).toBeNull();
});

it("hides Pay Now when the order is not awaiting VN Pay payment", async () => {
	const cod: OrderView = {
		...order,
		status: "PENDING",
		payment: { method: "COD", status: "PENDING", transactionId: null, paidAt: null },
	};
	vi.mocked(listOrders).mockResolvedValue({
		content: [cod],
		page: 0,
		size: 10,
		totalElements: 1,
		totalPages: 1,
	});

	await mount();

	expect(screen.queryByRole("button", { name: "Pay Now" })).toBeNull();
});
