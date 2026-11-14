import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

import { confirmStaffPayment, listStaffOrders } from "../api/staff-orders.api";
import type { Order, OrderPage } from "@/features/orders/types";
import { StaffOrdersView } from "./staff-orders-view";

vi.mock("../api/staff-orders.api", () => ({
	listStaffOrders: vi.fn(),
	confirmStaffPayment: vi.fn(),
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
	vi.mocked(listStaffOrders).mockReset().mockResolvedValue(page());
	vi.mocked(confirmStaffPayment).mockReset().mockResolvedValue({ status: "CONFIRMED" });
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
