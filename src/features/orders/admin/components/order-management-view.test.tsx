import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { MeData } from "@/features/auth/types";
import { useAuthStore } from "@/stores/auth-store";

import type { Order, OrderPage } from "../../types";
import {
	completeOrder,
	listStaffOrders,
	updateStaffOrderStatus,
} from "../api/admin-orders.api";
import { OrderManagementView } from "./order-management-view";

vi.mock("../api/admin-orders.api", () => ({
	completeOrder: vi.fn(),
	listStaffOrders: vi.fn(),
	updateStaffOrderStatus: vi.fn(),
}));

const admin: MeData = {
	userId: "USR_ADMIN",
	email: "admin@example.com",
	name: "Admin",
	phone: null,
	address: null,
	roleCode: "admin",
	roleName: "Administrator",
	permissions: ["order:read", "order:update", "order:complete"],
	hasPassword: true,
};

const pendingOrder: Order = {
	orderId: "ORD_1",
	customerId: "CUS_1",
	customerName: "Jane",
	status: "PENDING",
	total: 30000,
	address: "123 Demo St",
	recipientName: "Jane",
	phone: "0901234567",
	shippingProvince: null,
	shippingWard: null,
	ghnOrderCode: null,
	items: [
		{
			orderId: "ORD_1",
			variantId: "VAR_1",
			sku: "SKU-1",
			quantity: 2,
			unitPrice: 15000,
			createdAt: "2026-11-01T00:00:00Z",
			productName: "Ember Tetra",
			thumbnail: null,
			attributes: ["Blue"],
		},
	],
	createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z",
	payment: null,
};

function page(): OrderPage {
	return {
		content: [pendingOrder],
		page: 0,
		size: 10,
		totalElements: 21,
		totalPages: 3,
	};
}

async function flush() {
	await act(async () => {
		await Promise.resolve();
	});
}

async function mount() {
	render(
		<App>
			<OrderManagementView />
		</App>,
	);
	await flush();
}

beforeEach(() => {
	vi.mocked(listStaffOrders).mockReset().mockResolvedValue(page());
	vi.mocked(updateStaffOrderStatus)
		.mockReset()
		.mockResolvedValue({ ...pendingOrder, status: "CONFIRMED" });
	vi.mocked(completeOrder)
		.mockReset()
		.mockResolvedValue({ ...pendingOrder, status: "COMPLETED" });
	useAuthStore.setState({
		user: admin,
		status: "authenticated",
		sessionReady: true,
	});
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockReturnValue({
			matches: false,
			addListener() {},
			removeListener() {},
			addEventListener() {},
			removeEventListener() {},
		}),
	);
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	const originalGetComputedStyle = window.getComputedStyle.bind(window);
	vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
		originalGetComputedStyle(element),
	);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it("loads the first staff order page and renders totals", async () => {
	await mount();

	expect(listStaffOrders).toHaveBeenCalledExactlyOnceWith({ page: 0, size: 10 });
	expect(screen.getByText("#ORD_1")).toBeTruthy();
	expect(screen.getByText(/Ember Tetra/)).toBeTruthy();
	expect(screen.getByText("21 orders")).toBeTruthy();
});

it("applies the status filter without keeping a stale page", async () => {
	await mount();
	vi.mocked(listStaffOrders).mockClear();

	fireEvent.mouseDown(screen.getByRole("combobox"));
	const pendingOptions = await screen.findAllByText("Pending");
	fireEvent.click(pendingOptions.at(-1)!);
	await flush();

	expect(listStaffOrders).toHaveBeenCalledWith({
		page: 0,
		size: 10,
		status: "PENDING",
	});
});

it("debounces and trims the staff search query", async () => {
	vi.useFakeTimers();
	await mount();
	vi.mocked(listStaffOrders).mockClear();

	fireEvent.change(screen.getByRole("searchbox"), {
		target: { value: "  jane  " },
	});
	await act(async () => {
		vi.advanceTimersByTime(299);
	});
	expect(listStaffOrders).not.toHaveBeenCalled();

	await act(async () => {
		vi.advanceTimersByTime(1);
	});
	await flush();

	expect(listStaffOrders).toHaveBeenCalledExactlyOnceWith({
		page: 0,
		size: 10,
		q: "jane",
	});
});

it("hides actions the account cannot perform", async () => {
	useAuthStore.setState({
		user: { ...admin, permissions: ["order:read", "order:update"] },
	});
	await mount();

	expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
	expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
	expect(screen.queryByRole("button", { name: "Complete" })).toBeNull();
});

it("shows order details without a duplicate view action", async () => {
	await mount();

	fireEvent.click(screen.getByRole("button", { name: "View" }));
	const drawer = await screen.findByRole("dialog");

	expect(within(drawer).getByText(/Order #ORD_1/)).toBeTruthy();
	expect(within(drawer).queryByRole("button", { name: "View" })).toBeNull();
	expect(within(drawer).getByRole("button", { name: "Accept" })).toBeTruthy();
});

it("reloads the filtered list when a decision removes the order", async () => {
	await mount();

	fireEvent.mouseDown(screen.getByRole("combobox"));
	const pendingOptions = await screen.findAllByText("Pending");
	fireEvent.click(pendingOptions.at(-1)!);
	await flush();

	vi.mocked(listStaffOrders).mockClear();
	vi.mocked(listStaffOrders).mockResolvedValueOnce({
		content: [],
		page: 0,
		size: 10,
		totalElements: 0,
		totalPages: 0,
	});

	fireEvent.click(screen.getByRole("button", { name: "Accept" }));
	fireEvent.click(screen.getByRole("button", { name: "Accept order" }));
	await flush();
	await flush();

	expect(listStaffOrders).toHaveBeenCalledWith({
		page: 0,
		size: 10,
		status: "PENDING",
	});
	expect(screen.queryByText("#ORD_1")).toBeNull();
});

it("confirms and applies a pending-order decision", async () => {
	await mount();

	fireEvent.click(screen.getByRole("button", { name: "Accept" }));
	expect(screen.getByText("Accept order #ORD_1?")).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: "Accept order" }));
	await flush();

	expect(updateStaffOrderStatus).toHaveBeenCalledWith("ORD_1", "CONFIRMED");
	expect(screen.getByText("Confirmed")).toBeTruthy();
});

it("completes a non-terminal order through the admin override", async () => {
	await mount();

	fireEvent.click(screen.getByRole("button", { name: "Complete" }));
	fireEvent.click(screen.getByRole("button", { name: "Mark completed" }));
	await flush();

	expect(completeOrder).toHaveBeenCalledWith("ORD_1");
	expect(screen.getByText("Completed")).toBeTruthy();
});
