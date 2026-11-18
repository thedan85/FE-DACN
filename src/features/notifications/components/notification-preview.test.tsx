import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { NotificationView } from "../types";

type StoreState = {
	preview: NotificationView[];
	unreadCount: number;
	previewLoading: boolean;
	previewError: unknown;
	readiness: { admission: string; acknowledged: boolean; status: string };
	loadPreview: () => Promise<void>;
	markRead: (id: string) => Promise<void>;
};

const harness = vi.hoisted(() => ({ state: undefined as unknown as StoreState }));
vi.mock("../store", () => ({
	useNotificationStore: (selector: (state: StoreState) => unknown) => selector(harness.state),
}));

import { NotificationPreview } from "./notification-preview";

const live = { admission: "admitted", acknowledged: true, status: "live" };

function entry(orderId: string | null, message = "Order confirmed"): NotificationView {
	return {
		notificationId: "N1", userId: "U1", message, type: "ORDER", status: "UNREAD",
		createdAt: "2026-11-11T00:00:00Z", updatedAt: "2026-11-11T00:00:00Z",
		orderId, eventType: "ORDER_CONFIRMED", orderSequence: 2,
		occurredAt: "2026-11-11T01:02:00Z",
	};
}

let loadPreview: Mock<() => Promise<void>>;
let markRead: Mock<(id: string) => Promise<void>>;

beforeEach(() => {
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
		matches: false, addListener() {}, removeListener() {},
		addEventListener() {}, removeEventListener() {},
	}));
	loadPreview = vi.fn<() => Promise<void>>(async () => {});
	markRead = vi.fn<(id: string) => Promise<void>>(async () => {});
	harness.state = {
		preview: [], unreadCount: 0, previewLoading: false, previewError: null,
		readiness: live, loadPreview, markRead,
	};
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function mount(mode: "customer" | "company" = "customer") {
	return render(<App><NotificationPreview mode={mode} /></App>);
}

describe("NotificationPreview", () => {
	it("shows a loading skeleton while the on-demand preview is in flight", () => {
		harness.state.previewLoading = true;
		mount();
		expect(document.querySelector(".ant-skeleton")).not.toBeNull();
		expect(screen.queryByText("Order confirmed")).toBeNull();
	});

	it("shows an empty state with no entries", () => {
		mount();
		expect(screen.getByText("No notifications yet")).toBeTruthy();
	});

	it("shows an error with a Retry button that loads again", () => {
		harness.state.previewError = new Error("offline");
		mount();
		expect(screen.getByText("Could not load notifications.")).toBeTruthy();
		const retry = screen.getByRole("button", { name: "Retry" });
		fireEvent.click(retry);
		expect(loadPreview).toHaveBeenCalledTimes(1);
	});

	it("exposes a labelled dialog root in customer and company modes", () => {
		harness.state.preview = [entry("ORD_1")];
		mount();
		expect(screen.getByRole("dialog", { name: "Notifications preview" })).toBeTruthy();
		cleanup();
		mount("company");
		expect(screen.getByRole("dialog", { name: "Company notifications preview" })).toBeTruthy();
	});

	it("says connecting while the inbox is admitted but not yet acknowledged", () => {
		harness.state = {
			...harness.state,
			preview: [entry("ORD_1")],
			readiness: { admission: "admitted", acknowledged: false, status: "connecting" },
		};
		mount();
		expect(screen.getByText("Connecting to live updates…")).toBeTruthy();
		expect(screen.queryByText(/unavailable|degraded/i)).toBeNull();
	});

	it("says degraded when live updates have lost their connection", () => {
		harness.state = {
			...harness.state,
			preview: [entry("ORD_1")],
			readiness: { admission: "admitted", acknowledged: true, status: "degraded" },
		};
		mount();
		expect(screen.getByText(
			"Live updates are degraded; showing the latest saved notifications.",
		)).toBeTruthy();
		expect(screen.queryByText(/Live updates are unavailable|Connecting to live updates/)).toBeNull();
	});

	it("uses the unavailable wording only for unavailable live states", () => {
		const note = "Live updates are unavailable; showing the latest saved notifications.";
		for (const status of ["rest-only", "denied", "disabled", "unavailable"]) {
			harness.state = {
				...harness.state,
				preview: [entry("ORD_1")],
				readiness: { admission: "denied", acknowledged: false, status },
			};
			mount();
			expect(screen.getByText(note)).toBeTruthy();
			expect(screen.queryByText(/Connecting to live updates|Live updates are degraded/)).toBeNull();
			cleanup();
		}
	});

	it("does not claim a live connection when the inbox is admitted and acknowledged", () => {
		harness.state.preview = [entry("ORD_1")];
		mount();
		expect(screen.queryByText(/Live updates|Connecting to live updates/)).toBeNull();
	});

	it("links a customer entry with an orderId to the storefront order and shows its time", () => {
		harness.state.preview = [entry("ORD_777")];
		mount();
		const link = screen.getByRole("link", { name: "Order confirmed" });
		expect(link.getAttribute("href")).toBe("/account/orders/ORD_777");
		expect(document.querySelector("time")?.getAttribute("datetime")).toBe("2026-11-11T01:02:00Z");
	});

	it("encodes a reserved-character customer orderId as one path segment", () => {
		harness.state.preview = [entry("ORD/42?x")];
		mount();
		const link = screen.getByRole("link", { name: "Order confirmed" });
		expect(link.getAttribute("href")).toBe("/account/orders/ORD%2F42%3Fx");
	});

	it("renders a customer entry with no orderId as plain text without a link", () => {
		harness.state.preview = [entry(null, "Refund review pending")];
		mount();
		const row = within(screen.getByRole("listitem"));
		expect(row.getByText("Refund review pending")).toBeTruthy();
		expect(row.queryByRole("link")).toBeNull();
	});

	it("renders no link or mark action for an already-read company row", () => {
		harness.state.preview = [{ ...entry("ORD_777", "New COD order"), status: "READ" }];
		mount("company");
		const row = within(screen.getByRole("listitem"));
		expect(row.getByText("New COD order")).toBeTruthy();
		expect(document.querySelector("time")?.getAttribute("datetime")).toBe("2026-11-11T01:02:00Z");
		expect(row.queryByRole("link")).toBeNull();
		expect(row.queryByRole("button")).toBeNull();
	});

	it("shows a visible unread count and lets a failed mark be retried", async () => {
		harness.state.preview = [entry("ORD_777")];
		harness.state.unreadCount = 1;
		markRead.mockRejectedValueOnce(new Error("offline"));
		mount("company");
		expect(screen.getByText("1 unread")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /mark .* as read/i }));
		expect(await screen.findByText(/could not mark as read/i)).toBeTruthy();
		expect(screen.getByText("Unread", { exact: true })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /mark .* as read/i }));
		expect(markRead.mock.calls).toEqual([["N1"], ["N1"]]);
		expect(screen.queryByText(/could not mark as read/i)).toBeNull();
	});

	it("never renders an admin order link in customer mode", () => {
		harness.state.preview = [entry("ORD_777")];
		const { container } = mount();
		expect(container.querySelector('a[href^="/admin"]')).toBeNull();
	});

	it("keeps a long message fully in the document", () => {
		const long = "Order confirmed ".repeat(40);
		harness.state.preview = [entry(null, long)];
		mount();
		expect(screen.getByText(long.trim())).toBeTruthy();
	});
});
