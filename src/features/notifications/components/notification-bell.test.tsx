import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

type Readiness = { admission: string; acknowledged: boolean; status: string };
type StoreState = {
	unreadCount: number;
	preview: unknown[];
	previewLoading: boolean;
	previewError: unknown;
	readiness: Readiness;
	loadPreview: () => Promise<void>;
	invalidate: () => void;
};

const harness = vi.hoisted(() => ({ state: undefined as unknown as StoreState }));
vi.mock("../store", () => ({
	useNotificationStore: (selector: (state: StoreState) => unknown) => selector(harness.state),
}));

import { NotificationBell } from "./notification-bell";

const live: Readiness = { admission: "admitted", acknowledged: true, status: "live" };

let loadPreview: Mock<() => Promise<void>>;
let invalidate: Mock<() => void>;
const messageHolder: {
	api: ReturnType<typeof App.useApp>["message"] | undefined;
} = { api: undefined };

function Probe() {
	const api = App.useApp().message;
	useEffect(() => { messageHolder.api = api; }, [api]);
	return null;
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
	loadPreview = vi.fn<() => Promise<void>>(async () => {});
	invalidate = vi.fn<() => void>();
	messageHolder.api = undefined;
	harness.state = {
		unreadCount: 0,
		preview: [],
		previewLoading: false,
		previewError: null,
		readiness: live,
		loadPreview,
		invalidate,
	};
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function mount(mode: "customer" | "company" = "customer") {
	return render(<App><Probe /><NotificationBell mode={mode} /></App>);
}

function trigger(): HTMLButtonElement {
	return screen.getByRole("button", { name: /notifications/i }) as HTMLButtonElement;
}

describe("NotificationBell", () => {
	it("reads the shared count on render without fetching a list or preview", () => {
		harness.state.unreadCount = 132;
		mount();
		expect(trigger().getAttribute("aria-label")).toContain("132");
		expect(loadPreview).not.toHaveBeenCalled();
	});

	it("caps the visual badge at 99+ but keeps the actual count in the accessible name", () => {
		harness.state.unreadCount = 132;
		mount();
		expect(screen.getByText("99+")).toBeTruthy();
		expect(trigger().getAttribute("aria-label")).toBe("Notifications, 132 unread");
	});

	it("uses no-unread wording and shows no visual badge at zero", () => {
		mount();
		expect(trigger().getAttribute("aria-label")).toBe("No unread notifications");
		expect(screen.queryByText("99+")).toBeNull();
	});

	it("loads the preview once when opened by click", async () => {
		mount();
		fireEvent.click(trigger());
		await waitFor(() => expect(loadPreview).toHaveBeenCalledTimes(1));
	});

	it("exposes an accessible dialog for the customer preview while keeping the trigger state", async () => {
		mount();
		const bell = trigger();
		expect(bell.getAttribute("aria-haspopup")).toBe("dialog");
		fireEvent.click(bell);
		expect(bell.getAttribute("aria-expanded")).toBe("true");
		expect(await screen.findByRole("dialog", { name: "Notifications preview" })).toBeTruthy();
	});

	it("names the company preview dialog", async () => {
		mount("company");
		fireEvent.click(trigger());
		expect(await screen.findByRole("dialog", { name: "Company notifications preview" })).toBeTruthy();
	});

	it("opens on Enter and Space from the focused bell", async () => {
		mount();
		const bell = trigger();
		bell.focus();
		fireEvent.keyDown(bell, { key: "Enter" });
		await waitFor(() => expect(bell.getAttribute("aria-expanded")).toBe("true"));
		expect(loadPreview).toHaveBeenCalledTimes(1);

		fireEvent.keyDown(bell, { key: "Escape" });
		expect(bell.getAttribute("aria-expanded")).toBe("false");
		fireEvent.keyDown(bell, { key: " " });
		await waitFor(() => expect(bell.getAttribute("aria-expanded")).toBe("true"));
		expect(loadPreview).toHaveBeenCalledTimes(2);
	});

	it("closes on Escape and returns focus to the bell", async () => {
		mount();
		const bell = trigger();
		bell.focus();
		fireEvent.keyDown(bell, { key: "Enter" });
		await waitFor(() => expect(bell.getAttribute("aria-expanded")).toBe("true"));
		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(bell.getAttribute("aria-expanded")).toBe("false"));
		expect(document.activeElement).toBe(bell);
	});

	it("shows one shared count across customer and company bells with one fetch per open", async () => {
		harness.state.unreadCount = 132;
		render(<App><NotificationBell mode="customer" /><NotificationBell mode="company" /></App>);
		const bells = screen.getAllByRole("button", { name: /notifications/i });
		expect(bells).toHaveLength(2);
		for (const bell of bells) expect(bell.getAttribute("aria-label")).toContain("132");
		expect(screen.getAllByText("99+")).toHaveLength(2);
		expect(loadPreview).not.toHaveBeenCalled();

		fireEvent.click(bells[0]);
		await waitFor(() => expect(loadPreview).toHaveBeenCalledTimes(1));
	});

	it("reacts to an invalidation without raising any toast", async () => {
		harness.state.unreadCount = 4;
		const view = mount();
		expect(messageHolder.api).toBeDefined();
		const error = vi.spyOn(messageHolder.api!, "error");
		const warning = vi.spyOn(messageHolder.api!, "warning");
		const info = vi.spyOn(messageHolder.api!, "info");

		act(() => {
			harness.state = { ...harness.state, unreadCount: 7 };
			invalidate();
		});
		view.rerender(<App><Probe /><NotificationBell mode="customer" /></App>);

		expect(trigger().getAttribute("aria-label")).toBe("Notifications, 7 unread");
		expect(invalidate).toHaveBeenCalledTimes(1);
		expect(error).not.toHaveBeenCalled();
		expect(warning).not.toHaveBeenCalled();
		expect(info).not.toHaveBeenCalled();
		expect(document.querySelector(".ant-message")).toBeNull();
	});
});
