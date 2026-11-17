import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RealtimeConnectionManager } from "@/features/realtime/connection-manager";
import { clearSession, setAccessToken } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";
import { useNotificationStore } from "../store";
import { NotificationBell } from "./notification-bell";
import { NotificationInbox } from "./notification-inbox";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
	...await original<typeof import("@/lib/api/client")>(),
	apiFetch: apiFetchMock,
}));

const envelope = (data: unknown) => ({ code: 200, message: "OK", data });
const row = (id: string, status = "UNREAD", orderId: string | null = "ORD_1") => ({
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
});
const inbox = (content: unknown[], unreadCount: number, revision: number) => ({
	notifications: { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 },
	unreadCount,
	revision,
});

type Call = { path: string; method?: string; signal?: AbortSignal | null };
let calls: Call[];
let pending: Array<Call & { resolve: (value: unknown) => void }>;

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

function fakeManager(): RealtimeConnectionManager {
	return {
		onReconcile: vi.fn(() => () => {}),
		onInterestState: vi.fn(() => () => {}),
		subscribeInbox: vi.fn(() => () => {}),
		getInterestState: vi.fn(() => ({
			admission: "unavailable", acknowledged: false, status: "disabled",
		})),
	} as unknown as RealtimeConnectionManager;
}

function respondTo(match: (call: Call) => boolean, data: unknown): void {
	const index = pending.findIndex((entry) => match(entry));
	if (index < 0) throw new Error("no pending request matched");
	const [entry] = pending.splice(index, 1);
	entry.resolve(envelope(data));
}

async function flush(): Promise<void> {
	for (let i = 0; i < 20; i += 1) await Promise.resolve();
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
	calls = [];
	pending = [];
	apiFetchMock.mockReset();
	apiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
		const call: Call = { path, method: init?.method, signal: init?.signal };
		calls.push(call);
		let resolve!: (value: unknown) => void;
		const promise = new Promise<unknown>((yes) => { resolve = yes; });
		pending.push({ ...call, resolve });
		return promise;
	});
	useNotificationStore.getState().dispose();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	useNotificationStore.getState().dispose();
});

/** Configure and settle the provider's count wave before the page mounts. */
async function settleProviderCount(unreadCount: number, revision: number): Promise<void> {
	setUser("USR_1");
	useNotificationStore.getState().configure(fakeManager());
	await flush();
	await act(async () => {
		respondTo((call) => call.path === "notifications/unread-count", { unreadCount, revision });
	});
	await flush();
}

async function startSignedIn(
	mode: "customer" | "company" = "customer",
	unreadCount = 2,
	revision = 7,
) {
	await settleProviderCount(unreadCount, revision);
	const view = render(<App><NotificationInbox mode={mode} /></App>);
	await flush();
	return view;
}

function listCalls(): Call[] {
	return calls.filter((call) => call.path.startsWith("notifications?"));
}

describe("NotificationInbox with the shared store", () => {
	it("loads page 0 size 20 ALL on mount and reconciles the authoritative count", async () => {
		await startSignedIn();
		await act(async () => {
			respondTo((call) => call.path.startsWith("notifications?"), inbox([row("N1"), row("N2")], 2, 7));
		});
		expect(listCalls()).toEqual([expect.objectContaining({ path: "notifications?page=0&size=20" })]);
		expect(await screen.findByText("Notification N1")).toBeTruthy();
		expect(useNotificationStore.getState().unreadCount).toBe(2);
	});

	it("marks read and deletes from authoritative responses without a second store or fetch", async () => {
		await startSignedIn();
		await act(async () => {
			respondTo((call) => call.path.startsWith("notifications?"), inbox([row("N1"), row("N2")], 2, 7));
		});
		await screen.findByText("Notification N1");

		fireEvent.click(screen.getByRole("button", { name: "Mark notification N1 as read" }));
		await act(async () => {
			respondTo((call) => call.method === "PATCH", {
				notification: row("N1", "READ"), unreadCount: 1, revision: 8,
			});
		});
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 1, revision: 8 });
		expect(useNotificationStore.getState().list[0].status).toBe("READ");

		fireEvent.click(screen.getByRole("button", { name: "Delete notification N1" }));
		await act(async () => {
			respondTo((call) => call.method === "DELETE", { unreadCount: 1, revision: 9 });
		});
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 1, revision: 9 });
		expect(useNotificationStore.getState().list.map((item) => item.notificationId)).toEqual(["N2"]);
	});

	it("lets a lower-revision mutation response neither rewind the count nor resurrect a deleted row", async () => {
		await startSignedIn();
		await act(async () => {
			respondTo((call) => call.path.startsWith("notifications?"), inbox([row("N1"), row("N2")], 2, 7));
		});
		await screen.findByText("Notification N1");

		fireEvent.click(screen.getByRole("button", { name: "Delete notification N1" }));
		fireEvent.click(screen.getByRole("button", { name: "Mark notification N2 as read" }));
		await act(async () => {
			respondTo((call) => call.method === "DELETE", { unreadCount: 1, revision: 9 });
			respondTo((call) => call.method === "PATCH", {
				notification: row("N2", "READ"), unreadCount: 0, revision: 8,
			});
		});
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 1, revision: 9 });
		expect(useNotificationStore.getState().list.map((item) => item.notificationId)).toEqual(["N2"]);
		expect(screen.queryByText("Notification N1")).toBeNull();
	});

	it("ignores a duplicate in-flight delete so the count changes once", async () => {
		await startSignedIn();
		await act(async () => {
			respondTo((call) => call.path.startsWith("notifications?"), inbox([row("N1"), row("N2")], 2, 7));
		});
		await screen.findByText("Notification N1");

		const button = screen.getByRole("button", { name: "Delete notification N1" });
		fireEvent.click(button);
		fireEvent.click(button);
		expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1);
		await act(async () => {
			respondTo((call) => call.method === "DELETE", { unreadCount: 1, revision: 8 });
		});
		expect(useNotificationStore.getState().unreadCount).toBe(1);
	});

	it("shares one count between the customer bell and the inbox page", async () => {
		await settleProviderCount(2, 7);
		render(<App><NotificationBell mode="customer" /><NotificationInbox mode="customer" /></App>);
		await flush();
		await act(async () => {
			respondTo((call) => call.path.startsWith("notifications?"), inbox([row("N1")], 2, 7));
		});
		expect(await screen.findByRole("button", { name: "Notifications, 2 unread" })).toBeTruthy();
		expect(screen.getByText("2 unread")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Mark notification N1 as read" }));
		await act(async () => {
			respondTo((call) => call.method === "PATCH", {
				notification: row("N1", "READ"), unreadCount: 1, revision: 8,
			});
		});
		expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
		expect(screen.getByText("1 unread")).toBeTruthy();
	});

	it("ignores a pending old-account list on switch, then clears rows on logout", async () => {
		await startSignedIn("customer", 1, 7);
		// The inbox list request is still in flight when the account changes.
		const oldSignal = pending.find((call) => call.path.startsWith("notifications?"))!.signal!;
		expect(oldSignal.aborted).toBe(false);

		await act(async () => { setUser("USR_2"); });
		expect(oldSignal.aborted).toBe(true);
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 0, revision: 0, list: [] });

		// A stale list response for the old account must not apply.
		await act(async () => {
			respondTo((call) => call.signal === oldSignal, inbox([row("OLD")], 99, 99));
		});
		expect(useNotificationStore.getState().list).toEqual([]);

		// The new account fetches its own list, never reusing the old request.
		const fresh = pending.find((call) =>
			call.path.startsWith("notifications?") && call.signal && !call.signal.aborted,
		)!;
		expect(fresh).toBeTruthy();
		await act(async () => {
			fresh.resolve(envelope(inbox([row("NEW")], 3, 1)));
			pending.splice(pending.indexOf(fresh), 1);
		});
		await waitFor(() => expect(screen.getByText("Notification NEW")).toBeTruthy());

		const before = listCalls().length;
		await act(async () => { setUser(null); });
		await flush();
		expect(screen.getByText("Sign in to view your notifications.")).toBeTruthy();
		expect(useNotificationStore.getState().list).toEqual([]);
		expect(listCalls()).toHaveLength(before);
	});
});
