import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

import { completeOrder, confirmStaffPayment, listStaffOrders, shipStaffOrder, updateStaffOrderStatus } from "../api/staff-orders.api";
import { getGhnProvinces, getGhnWards } from "@/features/shipping/api/shipping.api";
import type { Order, OrderPage } from "@/features/orders/types";
import { StaffOrdersView } from "./staff-orders-view";

vi.mock("../api/staff-orders.api", () => ({
	listStaffOrders: vi.fn(),
	confirmStaffPayment: vi.fn(),
	shipStaffOrder: vi.fn(),
	updateStaffOrderStatus: vi.fn(),
	completeOrder: vi.fn(),
}));

vi.mock("@/features/shipping/api/shipping.api", () => ({
	getGhnProvinces: vi.fn(),
	getGhnWards: vi.fn(),
}));

const user = {
	userId: "USR_1",
	email: "staff@example.com",
	name: "Staff",
	phone: null,
	address: null,
	roleCode: "STAFF",
	roleName: "Staff",
	permissions: ["order:read", "order:update"],
	hasPassword: true,
};

const vietQrOrder: Order = {
	orderId: "ORD_QR",
	customerId: "CUS_1",
	customerName: "Jane",
	status: "PENDING" as const,
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
	payment: {
		method: "VIETQR" as const,
		status: "PENDING" as const,
		transactionId: null,
		paidAt: null,
	},
	paymentExpiresAt: null,
	cancellationReason: null,
};

const cancelledVietQrOrder: Order = {
	...vietQrOrder,
	orderId: "ORD_CANCELLED",
	status: "CANCELLED" as const,
	payment: {
		method: "VIETQR" as const,
		status: "FAILED" as const,
		transactionId: null,
		paidAt: null,
	},
};

const confirmedOrder: Order = {
	...vietQrOrder,
	orderId: "ORD_SHIP",
	status: "CONFIRMED",
	shippingProvince: "Hồ Chí Minh",
	shippingWard: "Phường Sài Gòn",
	payment: { ...vietQrOrder.payment!, method: "COD" },
};

const bookedOrder: Order = { ...confirmedOrder, ghnOrderCode: "GHN123" };

function page(
	orders = [vietQrOrder],
	pageNumber = 0,
	totalPages = 1,
	totalElements = orders.length,
): OrderPage {
	return {
		content: orders,
		page: pageNumber,
		size: 20,
		totalElements,
		totalPages,
	};
}

async function flush() {
	await act(async () => { await Promise.resolve(); });
}

function renderView() {
	render(
		<App>
			<StaffOrdersView />
		</App>,
	);
}

beforeEach(() => {
	// jsdom has no pseudo-element styles; Ant Design reads them to measure scrollbars.
	const getComputedStyle = window.getComputedStyle;
	vi.stubGlobal("getComputedStyle", (element: Element) => getComputedStyle(element));
	vi.mocked(listStaffOrders).mockReset().mockResolvedValue(page());
	vi.mocked(confirmStaffPayment).mockReset().mockResolvedValue({ status: "CONFIRMED" });
	vi.mocked(shipStaffOrder).mockReset().mockResolvedValue(bookedOrder);
	vi.mocked(updateStaffOrderStatus).mockReset().mockResolvedValue({ ...vietQrOrder, status: "CONFIRMED" });
	vi.mocked(completeOrder).mockReset().mockResolvedValue({ ...vietQrOrder, status: "COMPLETED" });
	vi.mocked(getGhnProvinces).mockReset().mockResolvedValue([
		{ id: 1, name: "Hồ Chí Minh" }, { id: 2, name: "Hanoi" },
	]);
	vi.mocked(getGhnWards).mockReset().mockImplementation(async (provinceId) =>
		provinceId === 1
			? [{ id: 10, name: "Phường Sài Gòn" }]
			: [{ id: 20, name: "Ba Dinh" }],
	);
	useAuthStore.setState({ status: "authenticated", user });
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

it("loads the PENDING queue by default", async () => {
	renderView();
	await flush();

	expect(listStaffOrders).toHaveBeenCalledTimes(1);
	expect(listStaffOrders).toHaveBeenCalledWith({ page: 0, size: 20, status: "PENDING" });
	expect(screen.getByText("#ORD_QR")).toBeTruthy();
});

it("confirms a VietQR payment and refreshes", async () => {
	renderView();
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
	fireEvent.click(screen.getByRole("button", { name: "Yes, confirm" }));
	await flush();

	expect(confirmStaffPayment).toHaveBeenCalledWith("ORD_QR");
	expect(listStaffOrders).toHaveBeenCalledTimes(2);
	expect(screen.getByText("Payment confirmed; order moved to Confirmed.")).toBeTruthy();
});

it("confirms a cancelled VietQR payment and warns", async () => {
	vi.mocked(listStaffOrders).mockResolvedValue(page([cancelledVietQrOrder]));
	vi.mocked(confirmStaffPayment).mockResolvedValue({ status: "REFUND_REQUIRED" });

	renderView();
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
	fireEvent.click(screen.getByRole("button", { name: "Yes, confirm" }));
	await flush();

	expect(screen.getByText("The order was cancelled before settlement. Refund the payment manually.")).toBeTruthy();
	expect(screen.queryByText("Payment confirmed; order moved to Confirmed.")).toBeNull();
});

it("renders a non-retryable access message on 403", async () => {
	vi.mocked(listStaffOrders).mockRejectedValue(new ApiError("Forbidden", 403));

	renderView();
	await flush();

	expect(screen.getByText("You do not have access to orders.")).toBeTruthy();
	expect(screen.getByText("Ask an administrator for the order:read permission.")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
});

it("renders a non-retryable error for other 4xx", async () => {
	vi.mocked(listStaffOrders).mockRejectedValue(new ApiError("Bad request", 400));

	renderView();
	await flush();

	expect(screen.getByText("Bad request")).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
});

it("hides confirm without order:update", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["order:read"] },
	});

	renderView();
	await flush();

	expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
});

it("hides confirm for non-VietQR payments", async () => {
	const creditCardOrder: Order = {
		...vietQrOrder,
		payment: {
			method: "CREDIT_CARD" as const,
			status: "PENDING" as const,
			transactionId: null,
			paidAt: null,
		},
	};
	vi.mocked(listStaffOrders).mockResolvedValue(page([creditCardOrder]));

	renderView();
	await flush();

	expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
});

it("hides confirm for a settled VietQR payment", async () => {
	const settledOrder: Order = {
		...vietQrOrder,
		payment: {
			method: "VIETQR" as const,
			status: "CONFIRMED" as const,
			transactionId: null,
			paidAt: null,
		},
	};
	vi.mocked(listStaffOrders).mockResolvedValue(page([settledOrder]));

	renderView();
	await flush();

	expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
});

it("shows confirm for a FAILED VietQR payment with refund copy", async () => {
	vi.mocked(listStaffOrders).mockResolvedValue(page([cancelledVietQrOrder]));

	renderView();
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

	expect(screen.getByText("This order was cancelled and the payment failed. Confirming records that the payment needs a refund.")).toBeTruthy();
	expect(screen.queryByText("Verify the bank transfer first. Confirming also accepts the order.")).toBeNull();
});

it("submits search explicitly and trims", async () => {
	renderView();
	await flush();

	const input = screen.getByPlaceholderText("Search by order ID");
	fireEvent.change(input, { target: { value: "  beta  " } });
	fireEvent.keyDown(input, { key: "Enter", keyCode: 13 });
	await flush();

	expect(listStaffOrders).toHaveBeenLastCalledWith({ page: 0, size: 20, status: "PENDING", q: "beta" });
});

it("caps search at 100 characters", async () => {
	renderView();
	await flush();

	const input = screen.getByPlaceholderText("Search by order ID");
	expect(input.getAttribute("maxLength")).toBe("100");
});

it("retries the list after a network failure", async () => {
	vi.mocked(listStaffOrders).mockRejectedValueOnce(new ApiError("offline", 0));

	renderView();
	await flush();

	expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: "Try again" }));
	await flush();

	expect(listStaffOrders).toHaveBeenCalledTimes(2);
});

it("confirm 403 shows the dedicated permission message", async () => {
	vi.mocked(confirmStaffPayment).mockRejectedValueOnce(new ApiError("Forbidden", 403));

	renderView();
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
	fireEvent.click(screen.getByRole("button", { name: "Yes, confirm" }));
	await flush();
	await flush();

	expect(screen.getByText("You do not have permission to confirm payments.")).toBeTruthy();
	expect(screen.queryByText("Payment confirmed; order moved to Confirmed.")).toBeNull();
});

it("steps back when the confirmed row empties the last page", async () => {
	vi.mocked(listStaffOrders)
		.mockResolvedValueOnce(page([vietQrOrder], 0, 2, 21))
		.mockResolvedValueOnce(page([vietQrOrder], 1, 2, 21))
		.mockResolvedValueOnce(page([], 1, 1, 20))
		.mockResolvedValueOnce(page([vietQrOrder], 0, 2, 21));

	renderView();
	await flush();

	fireEvent.click(screen.getByTitle("2"));
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
	fireEvent.click(screen.getByRole("button", { name: "Yes, confirm" }));
	await flush();
	await flush();

	expect(listStaffOrders).toHaveBeenLastCalledWith({ page: 0, size: 20, status: "PENDING" });
});

it.each([
	{ label: "confirmed COD", order: confirmedOrder, allowed: true },
	{
		label: "confirmed prepaid",
		order: { ...confirmedOrder, payment: { ...confirmedOrder.payment!, method: "VIETQR" as const, status: "CONFIRMED" as const } },
		allowed: true,
	},
	{ label: "pending", order: { ...confirmedOrder, status: "PENDING" as const }, allowed: false },
	{ label: "in transit", order: { ...confirmedOrder, status: "SHIPPING" as const }, allowed: false },
	{ label: "completed", order: { ...confirmedOrder, status: "COMPLETED" as const }, allowed: false },
	{ label: "cancelled", order: { ...confirmedOrder, status: "CANCELLED" as const }, allowed: false },
	{ label: "booked", order: bookedOrder, allowed: false },
	{ label: "missing payment", order: { ...confirmedOrder, payment: null }, allowed: false },
	{
		label: "unpaid prepaid",
		order: { ...confirmedOrder, payment: { ...confirmedOrder.payment!, method: "CREDIT_CARD" as const } },
		allowed: false,
	},
])("gates GHN booking for $label orders", async ({ order, allowed }) => {
	vi.mocked(listStaffOrders).mockResolvedValue(page([order]));
	renderView();
	await flush();

	expect(Boolean(screen.queryByRole("button", { name: "Ship with GHN" }))).toBe(allowed);
});

it("hides shipping without order:update", async () => {
	vi.mocked(listStaffOrders).mockResolvedValue(page([confirmedOrder]));
	useAuthStore.setState({ user: { ...user, permissions: ["order:read"] } });
	renderView();
	await flush();

	expect(screen.queryByRole("button", { name: "Ship with GHN" })).toBeNull();
});

it("requires confirmation and preserves the stored address without master-data calls", async () => {
	vi.mocked(listStaffOrders).mockResolvedValue(page([confirmedOrder]));
	renderView();
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Ship with GHN" }));

	// Ant Design uses the same generated id for every component under NODE_ENV=test.
	const dialog = screen.getByRole("dialog");
	expect(within(dialog).getByText("Book GHN shipment")).toBeTruthy();
	expect(within(dialog).getByText("Jane · 0900000000")).toBeTruthy();
	expect(within(dialog).getByText("12 Le Loi, Phường Sài Gòn, Hồ Chí Minh")).toBeTruthy();
	expect(within(dialog).getByText(/remains Confirmed until GHN reports pickup/)).toBeTruthy();
	expect(shipStaffOrder).not.toHaveBeenCalled();
	expect(getGhnProvinces).not.toHaveBeenCalled();

	fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
	await flush();
	expect(screen.queryByRole("dialog")).toBeNull();
	expect(shipStaffOrder).not.toHaveBeenCalled();
});

it("books once, refreshes, and shows the code without claiming pickup", async () => {
	vi.mocked(listStaffOrders)
		.mockResolvedValueOnce(page([confirmedOrder]))
		.mockResolvedValue(page([bookedOrder]));
	renderView();
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Ship with GHN" }));
	fireEvent.click(screen.getByRole("button", { name: "Book shipment" }));

	await waitFor(() => expect(screen.getByText("GHN123")).toBeTruthy());
	expect(shipStaffOrder).toHaveBeenCalledExactlyOnceWith("ORD_SHIP", undefined);
	expect(listStaffOrders).toHaveBeenCalledTimes(2);
	expect(screen.queryByRole("dialog")).toBeNull();
	expect(screen.queryByRole("button", { name: "Ship with GHN" })).toBeNull();
	expect(screen.getByText("Confirmed")).toBeTruthy();
	expect(screen.queryByText("Shipping")).toBeNull();
});

it.each([
	{ status: 403, message: "Forbidden", expected: "You do not have permission to book shipments." },
	{ status: 409, message: "order already has GHN order: GHN456", expected: "order already has GHN order: GHN456" },
	{ status: 502, message: "GHN is not configured", expected: "GHN is not configured" },
	{ status: 0, message: "offline", expected: "Unable to reach the server. Please check your connection and try again." },
])("keeps the booking dialog open on $status with an error", async ({ status, message, expected }) => {
	vi.mocked(listStaffOrders).mockResolvedValue(page([confirmedOrder]));
	vi.mocked(shipStaffOrder).mockRejectedValue(new ApiError(message, status));
	renderView();
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Ship with GHN" }));
	fireEvent.click(screen.getByRole("button", { name: "Book shipment" }));

	expect(await screen.findByText(expected)).toBeTruthy();
	expect(screen.getByRole("dialog")).toBeTruthy();
	expect(screen.queryByText(/GHN shipment booked:/)).toBeNull();
	expect(shipStaffOrder).toHaveBeenCalledTimes(1);
});

it("blocks duplicate booking and dismissal while GHN is responding", async () => {
	let resolveBooking!: (order: Order) => void;
	vi.mocked(shipStaffOrder).mockReturnValue(new Promise((resolve) => { resolveBooking = resolve; }));
	vi.mocked(listStaffOrders).mockResolvedValue(page([confirmedOrder]));
	renderView();
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Ship with GHN" }));
	const bookButton = screen.getByRole("button", { name: "Book shipment" });
	fireEvent.click(bookButton);
	fireEvent.click(bookButton);
	await waitFor(() => expect(shipStaffOrder).toHaveBeenCalledTimes(1));

	expect(bookButton.hasAttribute("disabled")).toBe(true);
	expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true);
	expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

	await act(async () => { resolveBooking(bookedOrder); });
});

it("repairs a legacy address and never submits a ward from the previous province", async () => {
	// Heavy rc-select interactions; exceeds the default 5s budget on slow machines.
	vi.mocked(listStaffOrders).mockResolvedValue(page([{
		...confirmedOrder, shippingProvince: null, shippingWard: null,
	}]));
	renderView();
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Ship with GHN" }));
	fireEvent.click(screen.getByRole("button", { name: "Book shipment" }));
	expect(await screen.findByText("Select a province or city.")).toBeTruthy();
	expect(shipStaffOrder).not.toHaveBeenCalled();

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Province or city" }));
	fireEvent.click(await screen.findByTitle("Hồ Chí Minh"));
	await flush();
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Ward or commune" }));
	fireEvent.click(await screen.findByTitle("Phường Sài Gòn"));
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Province or city" }));
	fireEvent.click(await screen.findByTitle("Hanoi"));
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Book shipment" }));
	expect(await screen.findByText("Select a ward or commune.")).toBeTruthy();
	expect(shipStaffOrder).not.toHaveBeenCalled();

	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Ward or commune" }));
	fireEvent.click(await screen.findByTitle("Ba Dinh"));
	fireEvent.change(screen.getByRole("textbox", { name: "Street address" }), {
		target: { value: "   " },
	});
	fireEvent.click(screen.getByRole("button", { name: "Book shipment" }));
	expect(await screen.findByText("Enter a street address.")).toBeTruthy();
	expect(shipStaffOrder).not.toHaveBeenCalled();
	fireEvent.change(screen.getByRole("textbox", { name: "Street address" }), {
		target: { value: "  20 Tran Hung Dao  " },
	});
	fireEvent.click(screen.getByRole("button", { name: "Book shipment" }));
	await waitFor(() => expect(shipStaffOrder).toHaveBeenCalledExactlyOnceWith("ORD_SHIP", {
		address: "20 Tran Hung Dao", province: "Hanoi", ward: "Ba Dinh",
	}));
}, 15000);

it("lets staff edit a valid stored address before booking", async () => {
	vi.mocked(listStaffOrders).mockResolvedValue(page([confirmedOrder]));
	renderView();
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Ship with GHN" }));
	fireEvent.click(screen.getByRole("button", { name: "Edit delivery address" }));

	expect(await screen.findByRole("combobox", { name: "Province or city" })).toBeTruthy();
	expect(screen.getByRole("textbox", { name: "Street address" }).getAttribute("value")).toBe("12 Le Loi");
	fireEvent.click(screen.getByRole("button", { name: "Book shipment" }));
	expect(await screen.findByText("Select a province or city.")).toBeTruthy();
	expect(shipStaffOrder).not.toHaveBeenCalled();
}, 15000);

it("offers Retry when address options fail to load", async () => {
	vi.mocked(listStaffOrders).mockResolvedValue(page([{
		...confirmedOrder, shippingProvince: null, shippingWard: null,
	}]));
	vi.mocked(getGhnProvinces).mockRejectedValueOnce(new ApiError("GHN unavailable", 502));
	renderView();
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Ship with GHN" }));
	expect(await screen.findByText("Could not load provinces. Please try again.")).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Retry" }));
	await waitFor(() => expect(screen.queryByText("Could not load provinces. Please try again.")).toBeNull());
	expect(getGhnProvinces).toHaveBeenCalledTimes(2);
});

it("locks the corrected address while booking is in flight", async () => {
	let resolveBooking!: (order: Order) => void;
	vi.mocked(shipStaffOrder).mockReturnValue(new Promise((resolve) => { resolveBooking = resolve; }));
	vi.mocked(listStaffOrders).mockResolvedValue(page([confirmedOrder]));
	renderView();
	await flush();
	fireEvent.click(screen.getByRole("button", { name: "Ship with GHN" }));
	fireEvent.click(screen.getByRole("button", { name: "Edit delivery address" }));
	await flush();
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Province or city" }));
	fireEvent.click(await screen.findByTitle("Hồ Chí Minh"));
	await flush();
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Ward or commune" }));
	fireEvent.click(await screen.findByTitle("Phường Sài Gòn"));
	fireEvent.click(screen.getByRole("button", { name: "Book shipment" }));
	await waitFor(() => expect(shipStaffOrder).toHaveBeenCalledTimes(1));

	expect(screen.getByRole("textbox", { name: "Street address" }).hasAttribute("disabled")).toBe(true);
	expect(screen.getByRole("combobox", { name: "Province or city" }).hasAttribute("disabled")).toBe(true);
	expect(screen.getByRole("combobox", { name: "Ward or commune" }).hasAttribute("disabled")).toBe(true);

	await act(async () => { resolveBooking(bookedOrder); });
});

it("accepts a pending order through the action dialog", async () => {
	renderView();
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Accept" }));
	fireEvent.click(screen.getByRole("button", { name: "Accept order" }));
	await flush();
	await flush();

	expect(updateStaffOrderStatus).toHaveBeenCalledWith("ORD_QR", "CONFIRMED");
	expect(screen.getByText("Order accepted.")).toBeTruthy();
});

it("rejects a pending order through the action dialog", async () => {
	vi.mocked(updateStaffOrderStatus).mockResolvedValue({ ...vietQrOrder, status: "CANCELLED" });
	renderView();
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Reject" }));
	fireEvent.click(screen.getByRole("button", { name: "Reject order" }));
	await flush();
	await flush();

	expect(updateStaffOrderStatus).toHaveBeenCalledWith("ORD_QR", "CANCELLED");
	expect(screen.getByText("Order rejected.")).toBeTruthy();
});

it("hides accept and reject without order:update", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["order:read"] },
	});

	renderView();
	await flush();

	expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
	expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
});

it("hides complete without order:complete", async () => {
	renderView();
	await flush();

	expect(screen.queryByRole("button", { name: "Complete" })).toBeNull();
});

it("completes a non-terminal order with order:complete", async () => {
	useAuthStore.setState({
		status: "authenticated",
		user: { ...user, permissions: ["order:read", "order:update", "order:complete"] },
	});

	renderView();
	await flush();

	fireEvent.click(screen.getByRole("button", { name: "Complete" }));
	fireEvent.click(screen.getByRole("button", { name: "Mark completed" }));
	await flush();
	await flush();

	expect(completeOrder).toHaveBeenCalledWith("ORD_QR");
	expect(screen.getByText("Order marked completed.")).toBeTruthy();
});

it("opens the detail drawer from the View action", async () => {
	renderView();
	await flush();

	fireEvent.click(screen.getAllByRole("button", { name: "View" })[0]);

	expect(await screen.findByText("Order #ORD_QR")).toBeTruthy();
	expect(screen.getByText("Recipient")).toBeTruthy();
	expect(screen.getByText("0900000000")).toBeTruthy();
	expect(screen.getByText("This order has no item lines.")).toBeTruthy();
});
