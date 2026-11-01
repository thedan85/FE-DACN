import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

import { listOrders } from "../../api/orders.api";
import type { OrderPage, OrderView } from "../../types";
import { OrderHistoryView } from "./order-history-view";

vi.mock("../../api/orders.api", () => ({ listOrders: vi.fn() }));

const order: OrderView = {
	orderId: "ORD_NEWEST", customerId: "CUS_1", customerName: "Jane",
	status: "CONFIRMED", total: 10000, address: "addr", recipientName: "Jane",
	phone: "090", items: [], createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z", payment: null,
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
