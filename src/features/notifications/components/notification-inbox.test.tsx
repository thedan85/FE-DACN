import { useEffect } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { clearSession, setAccessToken } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";
import type { NotificationFilter, NotificationView } from "../types";

type Readiness = { admission: string; acknowledged: boolean; status: string };
type StoreState = {
	unreadCount: number;
	list: NotificationView[];
	page: number;
	size: number;
	filter: NotificationFilter;
	totalElements: number;
	listLoading: boolean;
	listError: unknown | null;
	readiness: Readiness;
	loadList: Mock<(query?: { page?: number; size?: number; filter?: NotificationFilter }) => Promise<void>>;
	setFilter: Mock<(filter: NotificationFilter) => void>;
	setPage: Mock<(page: number) => void>;
	markRead: Mock<(id: string) => Promise<void>>;
	deleteNotification: Mock<(id: string) => Promise<void>>;
};

const harness = vi.hoisted(() => ({ state: undefined as unknown as StoreState }));
vi.mock("../store", () => ({
	useNotificationStore: (selector: (state: StoreState) => unknown) => selector(harness.state),
}));

import { NotificationInbox } from "./notification-inbox";

const live: Readiness = { admission: "admitted", acknowledged: true, status: "live" };

function entry(
	id = "N1",
	status: NotificationView["status"] = "UNREAD",
	orderId: string | null = "ORD_1",
): NotificationView {
	return {
		notificationId: id,
		userId: "USR_1",
		message: `Notification ${id}`,
		type: "ORDER",
		status,
		createdAt: "2026-11-11T00:00:00Z",
		updatedAt: "2026-11-11T00:00:00Z",
		orderId,
		eventType: "ORDER_CONFIRMED",
		orderSequence: 2,
		occurredAt: "2026-11-11T01:02:00Z",
	};
}

function makeState(): StoreState {
	const state = {
		unreadCount: 2,
		list: [entry("N1"), entry("N2")],
		page: 0,
		size: 20,
		filter: "ALL" as NotificationFilter,
		totalElements: 2,
		listLoading: false,
		listError: null,
		readiness: live,
	} as StoreState;
	state.loadList = vi.fn(async (query = {}) => {
		state.page = query.page ?? state.page;
		state.size = query.size ?? state.size;
		state.filter = query.filter ?? state.filter;
	});
	state.setFilter = vi.fn((filter) => { state.filter = filter; });
	state.setPage = vi.fn((page) => { state.page = Math.max(0, page); });
	state.markRead = vi.fn(async (id) => {
		state.list = state.list.map((item) =>
			item.notificationId === id ? { ...item, status: "READ" } : item,
		);
		state.unreadCount = Math.max(0, state.unreadCount - 1);
	});
	state.deleteNotification = vi.fn(async (id) => {
		state.list = state.list.filter((item) => item.notificationId !== id);
		state.unreadCount = Math.max(0, state.unreadCount - 1);
	});
	return state;
}

function setUser(userId: string | null) {
	if (userId === null) {
		clearSession();
		useAuthStore.setState({ user: null, status: "anonymous", sessionReady: true });
		return;
	}
	setAccessToken(`token-${userId}`);
	useAuthStore.setState({
		user: {
			userId,
			email: "local@example.invalid",
			name: "Local Fixture",
			phone: null,
			address: null,
			roleCode: userId === "USR_1" ? "Customer" : "Admin",
			roleName: userId === "USR_1" ? "Customer" : "Admin",
			permissions: [],
			hasPassword: true,
		},
		status: "authenticated",
		sessionReady: true,
	});
}

function mount(mode: "customer" | "company" = "customer") {
	return render(<App><NotificationInbox mode={mode} /></App>);
}

beforeEach(() => {
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false, addListener() {}, removeListener() {},
		addEventListener() {}, removeEventListener() {},
	}));
	vi.stubGlobal("ResizeObserver", class {
		observe() {}
		unobserve() {}
		disconnect() {}
	});
	harness.state = makeState();
	setUser("USR_1");
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	setUser(null);
});

describe("NotificationInbox auth gating", () => {
	it("shows a sign-in prompt and never fetches for an anonymous visitor", () => {
		setUser(null);
		mount();
		expect(screen.getByText("Sign in to view your notifications.")).toBeTruthy();
		expect(harness.state.loadList).not.toHaveBeenCalled();
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
	});

	it("shows a busy state while the session is still loading", () => {
		clearSession();
		useAuthStore.setState({ user: null, status: "loading", sessionReady: false });
		const { container } = mount();
		expect(container.querySelector(".ant-spin")).not.toBeNull();
		expect(harness.state.loadList).not.toHaveBeenCalled();
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
	});
});

describe("NotificationInbox list loading, filtering and pagination", () => {
	it("issues one initial list request with page 0, size 20 and default ALL filter", () => {
		mount();
		expect(harness.state.loadList).toHaveBeenCalledTimes(1);
		expect(harness.state.loadList).toHaveBeenCalledWith({ page: 0, size: 20, filter: "ALL" });
	});

	it("switching to UNREAD resets to page 0 and issues exactly one list request", () => {
		harness.state.page = 3;
		mount();
		harness.state.loadList.mockClear();
		fireEvent.click(screen.getByRole("radio", { name: "Unread" }));
		expect(harness.state.loadList).toHaveBeenCalledTimes(1);
		expect(harness.state.loadList).toHaveBeenCalledWith({ page: 0, size: 20, filter: "UNREAD" });
	});

	it("changing page keeps the active filter and size and requests the next page", () => {
		harness.state.totalElements = 40;
		const view = mount();
		fireEvent.click(screen.getByRole("radio", { name: "Unread" }));
		view.rerender(<App><NotificationInbox mode="customer" /></App>);
		harness.state.loadList.mockClear();
		const next = screen.getByRole("listitem", { name: /next page/i }).querySelector("button")!;
		fireEvent.click(next);
		expect(harness.state.loadList).toHaveBeenCalledTimes(1);
		expect(harness.state.loadList).toHaveBeenCalledWith({ page: 1, size: 20, filter: "UNREAD" });
	});

	it("shows a skeleton while loading, an empty state when empty, and error with retry", () => {
		harness.state.listLoading = true;
		const loading = mount();
		expect(loading.container.querySelector(".ant-skeleton")).not.toBeNull();
		cleanup();

		harness.state.listLoading = false;
		harness.state.list = [];
		harness.state.totalElements = 0;
		mount();
		expect(screen.getByText("No notifications yet")).toBeTruthy();
		cleanup();

		harness.state.listError = new Error("offline");
		harness.state.list = [];
		mount();
		expect(screen.getByText("Could not load notifications.")).toBeTruthy();
		harness.state.loadList.mockClear();
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(harness.state.loadList).toHaveBeenCalledTimes(1);
	});

	it("shows the shared REST-only wording and no disruptive toast", () => {
		harness.state.readiness = { admission: "denied", acknowledged: false, status: "rest-only" };
		messageHolder.api = undefined;
		render(<App><Probe /><NotificationInbox mode="customer" /></App>);
		expect(screen.getByText(
			"Live updates are unavailable; showing the latest saved notifications.",
		)).toBeTruthy();
		expect(messageHolder.api).toBeDefined();
		const error = vi.spyOn(messageHolder.api!, "error");
		const warning = vi.spyOn(messageHolder.api!, "warning");
		const info = vi.spyOn(messageHolder.api!, "info");
		expect(error).not.toHaveBeenCalled();
		expect(warning).not.toHaveBeenCalled();
		expect(info).not.toHaveBeenCalled();
	});
});

describe("NotificationInbox rows and actions", () => {
	it("links a customer row with an orderId to one encoded order path segment", () => {
		harness.state.list = [entry("N1", "UNREAD", "ORD/42?x")];
		const { container } = mount();
		const link = screen.getByRole("link", { name: "Notification N1" });
		expect(link.getAttribute("href")).toBe("/account/orders/ORD%2F42%3Fx");
		expect(container.querySelectorAll('a[href^="/admin"]')).toHaveLength(0);
	});

	it("renders a customer row with null orderId without a link", () => {
		harness.state.list = [entry("N1", "UNREAD", null)];
		const { container } = mount();
		expect(screen.getByText("Notification N1")).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Notification N1" })).toBeNull();
		expect(container.querySelector('a[href*="orders"]')).toBeNull();
	});

	it("renders company facts without customer order links or admin order links", () => {
		harness.state.list = [entry("N1", "UNREAD", "ORD_1")];
		const { container } = mount("company");
		expect(screen.getByText("ORD_1")).toBeTruthy();
		expect(screen.queryByRole("link", { name: /Notification N1|ORD_1/ })).toBeNull();
		expect(container.querySelector('a[href*="orders"]')).toBeNull();
		expect(container.querySelector('a[href^="/admin"]')).toBeNull();
	});

	it("marks a row read from the authoritative response and updates the shared count", () => {
		mount();
		const row = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("Notification N1"))!;
		fireEvent.click(row.querySelector("button[aria-label='Mark notification N1 as read']")!);
		expect(harness.state.markRead).toHaveBeenCalledWith("N1");
		expect(screen.queryByRole("button", { name: "Mark notification N1 as read" })).toBeNull();
		expect(screen.getByText("1 unread")).toBeTruthy();
	});

	it("deletes a row from the authoritative response", () => {
		mount();
		const row = screen.getAllByRole("listitem").find((li) => li.textContent?.includes("Notification N1"))!;
		fireEvent.click(row.querySelector("button[aria-label='Delete notification N1']")!);
		expect(harness.state.deleteNotification).toHaveBeenCalledWith("N1");
		expect(screen.queryByText("Notification N1")).toBeNull();
		expect(screen.getByText("1 unread")).toBeTruthy();
	});

	it("requests page 0 after deleting the last row when the committed total is zero", async () => {
		harness.state.totalElements = 0;
		harness.state.list = [entry("N1")];
		const view = mount();
		harness.state.page = 2;
		view.rerender(<App><NotificationInbox mode="customer" /></App>);
		harness.state.loadList.mockClear();
		fireEvent.click(screen.getByRole("button", { name: "Delete notification N1" }));
		await waitFor(() => expect(harness.state.loadList).toHaveBeenCalledWith({
			page: 0, size: 20, filter: "ALL",
		}));
		expect(harness.state.totalElements).toBe(0);
	});

	it("keeps the row and count on a mutation error and retries successfully", async () => {
		harness.state.markRead = vi.fn(async () => { throw new Error("offline"); });
		const view = mount();
		fireEvent.click(screen.getByRole("button", { name: "Mark notification N1 as read" }));
		// The failed action stays visible with an inline error affordance.
		expect(screen.getByRole("button", { name: "Mark notification N1 as read" })).toBeTruthy();
		const alert = await screen.findByText("Could not mark this notification as read.");
		expect(alert).toBeTruthy();
		expect(screen.getByText("2 unread")).toBeTruthy();

		harness.state.markRead = vi.fn(async (id) => {
			harness.state.list = harness.state.list.map((item) =>
				item.notificationId === id ? { ...item, status: "READ" } : item,
			);
			harness.state.unreadCount = 1;
		});
		view.rerender(<App><NotificationInbox mode="customer" /></App>);
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(screen.queryByText("Could not mark this notification as read.")).toBeNull();
		expect(await screen.findByText("1 unread")).toBeTruthy();
	});

	it("issues only one request per row and action while that action is in flight", () => {
		let resolve!: () => void;
		const flight = new Promise<void>((yes) => { resolve = yes; });
		harness.state.deleteNotification = vi.fn(() => flight);
		mount();
		const button = screen.getByRole("button", { name: "Delete notification N1" });
		fireEvent.click(button);
		fireEvent.click(button);
		fireEvent.click(button);
		expect(harness.state.deleteNotification).toHaveBeenCalledTimes(1);
		expect(harness.state.unreadCount).toBe(2);
		resolve();
	});

	it("also dedupes repeated read clicks for the same row", () => {
		let resolve!: () => void;
		const flight = new Promise<void>((yes) => { resolve = yes; });
		harness.state.markRead = vi.fn(() => flight);
		mount();
		const button = screen.getByRole("button", { name: "Mark notification N1 as read" });
		fireEvent.click(button);
		fireEvent.click(button);
		expect(harness.state.markRead).toHaveBeenCalledTimes(1);
		expect(harness.state.unreadCount).toBe(2);
		resolve();
	});
});

const messageHolder: { api: ReturnType<typeof App.useApp>["message"] | undefined } = { api: undefined };
function Probe() {
	const api = App.useApp().message;
	useEffect(() => { messageHolder.api = api; }, [api]);
	return null;
}
