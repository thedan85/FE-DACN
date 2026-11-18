import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
	...await original<typeof import("@/lib/api/client")>(),
	apiFetch: apiFetchMock,
}));

import { clearSession } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";
import { useNotificationStore } from "../store";
import { NotificationBell } from "./notification-bell";

const envelope = (data: unknown) => ({ code: 200, message: "OK", data });
const row = {
	notificationId: "N1", userId: "U1", message: "Order confirmed", type: "ORDER",
	status: "UNREAD", createdAt: "2026-11-11T00:00:00Z", updatedAt: "2026-11-11T00:00:00Z",
	orderId: "ORD_1", eventType: "ORDER_CONFIRMED", orderSequence: 2,
	occurredAt: "2026-11-11T01:02:00Z",
};
const inbox = {
	notifications: { content: [row], page: 0, size: 5, totalElements: 1, totalPages: 1 },
	unreadCount: 1, revision: 1,
};

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => { resolve = yes; });
	return { promise, resolve };
}

function previewRequests(): number {
	return apiFetchMock.mock.calls.filter(([path]) => String(path).startsWith("notifications?")).length;
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
	clearSession();
	useAuthStore.setState({ user: null, status: "anonymous", sessionReady: true });
	apiFetchMock.mockReset();
	useNotificationStore.getState().dispose();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	useNotificationStore.getState().dispose();
});

it("closes on the second click and reuses the pending request on reopen", async () => {
	const flight = deferred<unknown>();
	apiFetchMock.mockImplementation(async (path: string) =>
		String(path).startsWith("notifications?") ? flight.promise : envelope({ unreadCount: 0, revision: 0 }));

	render(<App><NotificationBell mode="customer" /></App>);
	const bell = screen.getByRole("button", { name: /notifications/i });
	fireEvent.click(bell);
	await waitFor(() => expect(bell.getAttribute("aria-expanded")).toBe("true"));
	expect(previewRequests()).toBe(1);

	fireEvent.click(bell);
	expect(bell.getAttribute("aria-expanded")).toBe("false");
	expect(previewRequests()).toBe(1);

	fireEvent.click(bell);
	expect(bell.getAttribute("aria-expanded")).toBe("true");
	expect(previewRequests()).toBe(1);

	flight.resolve(envelope(inbox));
	await waitFor(() => expect(useNotificationStore.getState().previewLoading).toBe(false));
	expect(useNotificationStore.getState().preview).toHaveLength(1);
	expect(bell.getAttribute("aria-expanded")).toBe("true");
});
