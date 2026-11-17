import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RealtimeConnectionManager } from "@/features/realtime/connection-manager";
import { JoinScheduler } from "@/features/realtime/join-scheduler";
import { clearSession, setAccessToken } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";
import { useNotificationStore } from "./store";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
	...await original<typeof import("@/lib/api/client")>(),
	apiFetch: apiFetchMock,
}));

type Call = { path: string; init: RequestInit };
const INBOX_TOPIC = "inbox:77";
const row = (id = "NOTI_1", status = "UNREAD") => ({
	notificationId: id,
	userId: "USR_1",
	message: "Order confirmed",
	type: "ORDER",
	status,
	createdAt: "2026-11-11T00:00:00Z",
	updatedAt: "2026-11-11T00:00:00Z",
	orderId: "ORD_1",
	eventType: "ORDER_CONFIRMED",
	orderSequence: 2,
	occurredAt: "2026-11-11T00:00:00Z",
});
const envelope = (data: unknown) => ({ code: 200, message: "OK", data });
const inboxData = (content: unknown[], unreadCount: number, revision: number, page = 0, size = 20) => ({
	notifications: { content, page, size, totalElements: content.length, totalPages: 1 },
	unreadCount,
	revision,
});
const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => { resolve = yes; });
	return { promise, resolve };
};
async function flush() {
	for (let i = 0; i < 80; i += 1) await Promise.resolve();
}

const cleanups: Array<() => void> = [];

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(0);
	clearSession();
	useAuthStore.setState({ user: null, status: "anonymous", sessionReady: true });
	apiFetchMock.mockReset();
	useNotificationStore.getState().dispose();
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
	useNotificationStore.getState().dispose();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function setUser(userId: string | null) {
	if (userId === null) {
		clearSession();
		useAuthStore.setState({ user: null, status: "anonymous", sessionReady: true });
		return;
	}
	setAccessToken(`token-${userId}`);
	useAuthStore.setState({
		user: { userId, email: "local@example.invalid", name: "Local Fixture", phone: null, address: null,
			roleCode: "Customer", roleName: "Customer", permissions: [], hasPassword: true },
		status: "authenticated",
		sessionReady: true,
	});
}

type Options = {
	configured?: boolean;
	admitInbox?: boolean;
	admittedStock?: string[];
	auto?: boolean;
	userId?: string;
};

function setup(options: Options = {}) {
	const configured = options.configured !== false;
	const admitInbox = options.admitInbox !== false;
	const admittedStock = options.admittedStock ?? [];
	const auto = options.auto !== false;
	const userId = options.userId ?? "USR_1";
	setUser(userId);

	const channels: Array<{ topic: string; status: (value: string) => void; hint: ReturnType<typeof vi.fn> }> = [];
	const createClient = vi.fn(() => ({
		realtime: { setAuth: vi.fn(), disconnect: vi.fn() },
		removeChannel: vi.fn(),
		channel: (topic: string) => {
			const created = { topic, status: (_value: string) => { void _value; }, hint: vi.fn() };
			channels.push(created);
			return {
				on: (_type: string, _filter: unknown, listener: () => void) => { created.hint = vi.fn(listener); },
				subscribe: (listener: (value: string) => void) => { created.status = listener; },
			};
		},
	}) as unknown as SupabaseClient);
	const credentials = vi.fn(async () => ({
		accessToken: "local-controlled-token",
		expiresAt: new Date(Date.now() + 300_000).toISOString(),
		admittedProductIds: admittedStock,
		inboxTopic: admitInbox ? INBOX_TOPIC : null,
	}));
	const manager = new RealtimeConnectionManager({
		env: () => configured ? { url: "https://local.invalid", publishableKey: "local" } : null,
		createClient,
		fetchCredentials: credentials,
		random: () => 0,
		joinScheduler: new JoinScheduler(() => 0, 0),
	});
	manager.start();
	manager.setAccount(userId);
	cleanups.push(() => manager.stop());

	const responses = {
		count: { unreadCount: 4, revision: 7 },
		inbox: inboxData([row()], 4, 7),
		read: { notification: row("NOTI_1", "READ"), unreadCount: 3, revision: 8 },
		deleted: { unreadCount: 3, revision: 9 },
	};
	const calls: Call[] = [];
	const pending: Array<{ call: Call; request: ReturnType<typeof deferred<unknown>> }> = [];
	function responseFor(call: Call): unknown {
		if (call.path.startsWith("notifications/unread-count")) return envelope(responses.count);
		if (call.path.startsWith("notifications?")) {
			const params = new URLSearchParams(call.path.split("?")[1]);
			return envelope({
				...responses.inbox,
				notifications: {
					...responses.inbox.notifications,
					page: Number(params.get("page")),
					size: Number(params.get("size")),
				},
			});
		}
		if (call.init.method === "PATCH") return envelope(responses.read);
		if (call.init.method === "DELETE") return envelope(responses.deleted);
		throw new Error(`unexpected path ${call.path}`);
	}
	apiFetchMock.mockImplementation(async (path: string, init: RequestInit) => {
		const call = { path, init };
		calls.push(call);
		if (auto) return responseFor(call);
		const request = deferred<unknown>();
		pending.push({ call, request });
		return request.promise;
	});

	const store = useNotificationStore.getState();
	return {
		manager, store, calls, pending, channels, responses, credentials, createClient,
		setResponses: (patch: Partial<typeof responses>) => Object.assign(responses, patch),
		resolveNext: (data: unknown) => { pending.shift()!.request.resolve(data); },
		resolveMatching: (path: string, data: unknown) => {
			const index = pending.findIndex((entry) => entry.call.path === path);
			const [entry] = pending.splice(index, 1);
			entry.request.resolve(envelope(data));
		},
		resolveAt: (index: number, data: unknown) => {
			const [entry] = pending.splice(index, 1);
			entry.request.resolve(envelope(data));
		},
		resolveAll: (count: unknown, inbox: unknown) => {
			while (pending.length) {
				const next = pending.shift()!;
				next.request.resolve(envelope(
					next.call.path.startsWith("notifications/unread-count") ? count : inbox,
				));
			}
		},
		inboxChannel: () => channels.find((channel) => channel.topic === INBOX_TOPIC),
	};
}

describe("account-scoped notification store with the accepted real manager", () => {
	it("registers reconcile/status observers and inbox interest before the initial count fetch, using only the granted topic", async () => {
		const s = setup({ configured: true, admitInbox: true, auto: false, userId: "USR_42" });
		const reconcile = vi.spyOn(s.manager, "onReconcile");
		const observe = vi.spyOn(s.manager, "onInterestState");
		const subscribe = vi.spyOn(s.manager, "subscribeInbox");
		const getState = vi.spyOn(s.manager, "getInterestState");

		s.store.configure(s.manager);
		await flush();

		expect(reconcile).toHaveBeenCalledTimes(1);
		expect(observe).toHaveBeenCalledWith({ kind: "inbox" }, expect.any(Function));
		expect(getState).toHaveBeenCalledWith({ kind: "inbox" });
		expect(subscribe).toHaveBeenCalledWith(expect.any(Function));
		expect(observe.mock.invocationCallOrder[0]).toBeLessThan(apiFetchMock.mock.invocationCallOrder[0]);
		expect(subscribe.mock.invocationCallOrder[0]).toBeLessThan(apiFetchMock.mock.invocationCallOrder[0]);
		expect(reconcile.mock.invocationCallOrder[0]).toBeLessThan(apiFetchMock.mock.invocationCallOrder[0]);
		expect(s.channels.map((channel) => channel.topic)).toEqual([INBOX_TOPIC]);
		expect(s.calls[0].path).toBe("notifications/unread-count");
	});

	it("fetches count by default and loads list pages/filters on demand", async () => {
		const s = setup({ configured: false });
		s.store.configure(s.manager);
		await flush();
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 4, revision: 7, countLoading: false });

		await s.store.loadList();
		expect(s.calls.at(-1)!.path).toBe("notifications?page=0&size=20");
		expect(useNotificationStore.getState().list).toHaveLength(1);

		await s.store.loadList({ page: 1, filter: "UNREAD" });
		expect(s.calls.at(-1)!.path).toBe("notifications?page=1&size=20&status=UNREAD");
		expect(useNotificationStore.getState().filter).toBe("UNREAD");

		await s.store.loadList({ filter: "READ" });
		expect(s.calls.at(-1)!.path).toBe("notifications?page=1&size=20&status=READ");
	});

	it("keeps an error state for a malformed count envelope and clears it on dispose", async () => {
		const s = setup({ configured: false, auto: false });
		s.store.configure(s.manager);
		await flush();
		s.resolveNext(envelope({ unreadCount: "4", revision: 7 }));
		await flush();
		expect(useNotificationStore.getState().countError).toBeTruthy();
		expect(useNotificationStore.getState().countLoading).toBe(false);
		expect(useNotificationStore.getState().unreadCount).toBe(0);
		s.store.dispose();
		expect(useNotificationStore.getState()).toMatchObject({
			unreadCount: 0, list: [], countError: null, countLoading: false,
			readiness: { admission: "unavailable", acknowledged: false, status: "disabled" },
		});
	});

	it("reconciles authoritative mutation bodies without optimistic deltas", async () => {
		const s = setup({ configured: false, auto: false });
		s.store.configure(s.manager);
		await flush();
		s.resolveNext(envelope(s.responses.count));
		await flush();
		const listing = s.store.loadList();
		await flush();
		s.resolveNext(envelope(s.responses.inbox));
		await listing;
		await flush();

		const reading = s.store.markRead("NOTI_1");
		await flush();
		expect(useNotificationStore.getState().unreadCount).toBe(4);
		const readCall = s.calls.at(-1)!;
		expect(readCall.path).toBe("notifications/NOTI_1");
		expect(readCall.init.method).toBe("PATCH");
		expect(readCall.init.body).toBe(JSON.stringify({ status: "READ" }));
		s.resolveNext(envelope(s.responses.read));
		await reading;
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 3, revision: 8 });
		expect(useNotificationStore.getState().list[0]).toMatchObject({ notificationId: "NOTI_1", status: "READ" });

		const deleting = s.store.deleteNotification("NOTI_1");
		await flush();
		expect(useNotificationStore.getState().unreadCount).toBe(3);
		const deleteCall = s.calls.at(-1)!;
		expect(deleteCall.path).toBe("notifications/NOTI_1");
		expect(deleteCall.init.method).toBe("DELETE");
		expect(deleteCall.init.body).toBeUndefined();
		s.resolveNext(envelope(s.responses.deleted));
		await deleting;
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 3, revision: 9, list: [] });
	});

	it("never lets a stale or lower-revision REST snapshot overwrite a newer applied revision", async () => {
		const s = setup({ configured: false, auto: false });
		s.store.configure(s.manager);
		await flush();
		s.resolveNext(envelope({ unreadCount: 4, revision: 7 }));
		await flush();
		const listing = s.store.loadList();
		await flush();
		s.resolveNext(envelope(inboxData([row()], 4, 7)));
		await listing;
		await flush();

		s.store.invalidate();
		await flush();
		s.resolveNext(envelope({ unreadCount: 99, revision: 5 }));
		await flush();
		s.resolveNext(envelope(inboxData([row("STALE")], 99, 5)));
		await flush();
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 4, revision: 7 });

		const staleList = s.store.loadList();
		await flush();
		s.resolveNext(envelope(inboxData([row("FRESH_1")], 99, 5)));
		await staleList;
		await flush();
		expect(useNotificationStore.getState().list[0].notificationId).toBe("NOTI_1");
	});

	it("newest list request wins when an older page-0 refresh settles last at the same revision", async () => {
		const s = setup({ configured: false, auto: false });
		s.store.configure(s.manager);
		await flush();
		s.resolveNext(envelope({ unreadCount: 4, revision: 7 }));
		await flush();

		const openList = s.store.loadList();
		await flush();
		s.resolveMatching("notifications?page=0&size=20", inboxData([row("OLD_PAGE0")], 4, 7, 0, 20));
		await openList;
		await flush();
		expect(useNotificationStore.getState().page).toBe(0);

		// Open-list refresh through the wave/reconcile path, still at page 0.
		s.store.invalidate();
		await flush();
		s.resolveMatching("notifications/unread-count", { unreadCount: 4, revision: 7 });
		await flush();
		expect(s.calls.at(-1)!.path).toBe("notifications?page=0&size=20");

		// A newer page-1 request starts while the page-0 refresh is in flight.
		const newer = s.store.loadList({ page: 1, size: 20 });
		await flush();
		expect(s.calls.at(-1)!.path).toBe("notifications?page=1&size=20");

		s.resolveMatching("notifications?page=1&size=20", inboxData([row("PAGE1")], 4, 7, 1, 20));
		await newer;
		await flush();
		expect(useNotificationStore.getState()).toMatchObject({ page: 1, totalElements: 1 });
		expect(useNotificationStore.getState().list[0].notificationId).toBe("PAGE1");

		// Same revision, older list id: the late page-0 response must not clobber page 1.
		s.resolveMatching("notifications?page=0&size=20", inboxData([row("OLD_PAGE0_LATE")], 4, 7, 0, 20));
		await flush();
		expect(useNotificationStore.getState().page).toBe(1);
		expect(useNotificationStore.getState().list[0].notificationId).toBe("PAGE1");

		// The lower-revision response is still rejected: intent is committed, list/count are not.
		const lower = s.store.loadList({ page: 2, size: 20 });
		await flush();
		expect(useNotificationStore.getState().page).toBe(2);
		s.resolveMatching("notifications?page=2&size=20", inboxData([row("LOWER")], 99, 5, 2, 20));
		await lower;
		await flush();
		expect(useNotificationStore.getState().list[0].notificationId).toBe("PAGE1");
		expect(useNotificationStore.getState().unreadCount).toBe(4);

		// Duplicate invalidations coalesce and still fetch after the newest request settles.
		const before = s.calls.length;
		s.store.invalidate();
		s.store.invalidate();
		await flush();
		expect(s.calls.length).toBe(before + 1);
		s.resolveAll({ unreadCount: 6, revision: 8 }, inboxData([row("AFTER")], 6, 8, 1, 20));
		await flush();
		s.resolveAll({ unreadCount: 6, revision: 8 }, inboxData([row("AFTER")], 6, 8, 1, 20));
		await flush();
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 6, revision: 8 });
	});

	it("a later wave reads the user's committed page when its count resolves after loadList", async () => {
		const s = setup({ configured: false, auto: false });
		s.store.configure(s.manager);
		await flush();
		s.resolveNext(envelope({ unreadCount: 4, revision: 7 }));
		await flush();

		// Open the list at page 0, then start a wave whose count is still in flight.
		const openList = s.store.loadList();
		await flush();
		s.resolveMatching("notifications?page=0&size=20", inboxData([row("OLD_PAGE0")], 4, 7, 0, 20));
		await openList;
		await flush();
		s.store.invalidate();
		await flush();
		expect(s.pending.some((entry) => entry.call.path === "notifications/unread-count")).toBe(true);

		// User intent starts while the wave count is in flight; page 1 is committed now.
		const newer = s.store.loadList({ page: 1, size: 20 });
		await flush();
		expect(useNotificationStore.getState().page).toBe(1);
		expect(s.calls.at(-1)!.path).toBe("notifications?page=1&size=20");

		// The wave count resolves afterwards and must read the committed page 1.
		s.resolveMatching("notifications/unread-count", { unreadCount: 4, revision: 7 });
		await flush();
		expect(s.calls.at(-1)!.path).toBe("notifications?page=1&size=20");
		expect(s.calls.filter((call) => call.path === "notifications?page=0&size=20")).toHaveLength(1);

		// pending[0] is the user's request, pending[1] is the wave's newer one.
		s.resolveAt(1, inboxData([row("WAVE_PAGE1")], 4, 7, 1, 20));
		await flush();
		expect(useNotificationStore.getState().page).toBe(1);
		expect(useNotificationStore.getState().list[0].notificationId).toBe("WAVE_PAGE1");

		// The older user response settles last; the sequence fence keeps page 1 applied.
		s.resolveAt(0, inboxData([row("USER_PAGE1")], 4, 7, 1, 20));
		await newer;
		await flush();
		expect(useNotificationStore.getState().page).toBe(1);
		expect(useNotificationStore.getState().list[0].notificationId).toBe("WAVE_PAGE1");
	});

	it("clears private data and aborts in-flight work on account switch and logout", async () => {
		const s = setup({ configured: true, admitInbox: true, auto: false });
		s.store.configure(s.manager);
		await flush();
		const oldChannel = s.inboxChannel()!;
		expect(pendingSignal(s, 0).aborted).toBe(false);

		setUser("USR_2");
		s.manager.setAccount("USR_2");
		expect(pendingSignal(s, 0).aborted).toBe(true);
		expect(useNotificationStore.getState()).toMatchObject({
			unreadCount: 0, revision: 0, list: [],
		});
		expect(useNotificationStore.getState().readiness.acknowledged).toBe(false);
		expect(useNotificationStore.getState().readiness.status).not.toBe("live");
		s.resolveNext(envelope({ unreadCount: 99, revision: 99 }));
		await flush();
		expect(useNotificationStore.getState().unreadCount).toBe(0);

		oldChannel.status("SUBSCRIBED");
		await flush();
		expect(useNotificationStore.getState().readiness.status).not.toBe("live");

		await flush();
		s.resolveNext(envelope({ unreadCount: 1, revision: 2 }));
		await flush();
		expect(useNotificationStore.getState().unreadCount).toBe(1);

		const beforeLogout = s.calls.length;
		setUser(null);
		s.manager.setAccount(null);
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 0, revision: 0, list: [] });
		await flush();
		expect(s.calls.length).toBe(beforeLogout);
	});

	it("coalesces duplicate invalidations and schedules a dirty follow-up for work arriving mid-flight", async () => {
		const s = setup({ configured: false, auto: false });
		s.store.configure(s.manager);
		await flush();
		s.resolveNext(envelope({ unreadCount: 4, revision: 7 }));
		await flush();
		expect(s.calls).toHaveLength(1);

		s.store.invalidate();
		s.store.invalidate();
		await flush();
		expect(s.calls).toHaveLength(2);

		s.store.invalidate();
		await flush();
		expect(s.calls).toHaveLength(3);
		s.resolveAll({ unreadCount: 6, revision: 8 }, inboxData([row()], 6, 8));
		await flush();
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 6, revision: 8 });
	});

	it("holds the inbox ACK, then reconciles fresh count/content with reactive live status and no Broadcast", async () => {
		const s = setup({ configured: true, admitInbox: true, auto: false });
		s.store.configure(s.manager);
		await flush();
		expect(useNotificationStore.getState().readiness).toMatchObject({
			admission: "admitted", acknowledged: false, status: "connecting",
		});
		s.resolveNext(envelope({ unreadCount: 4, revision: 7 }));
		await flush();
		const listing = s.store.loadList();
		await flush();
		s.resolveNext(envelope(inboxData([row()], 4, 7)));
		await listing;
		await flush();
		expect(useNotificationStore.getState().list).toHaveLength(1);

		s.setResponses({
			count: { unreadCount: 6, revision: 8 },
			inbox: inboxData([row(), row("NOTI_2")], 6, 8),
		});
		const channel = s.inboxChannel()!;
		channel.status("SUBSCRIBED");
		expect(useNotificationStore.getState().readiness).toMatchObject({
			admission: "admitted", acknowledged: true, status: "live",
		});
		expect(s.calls).toHaveLength(2);
		expect(channel.hint).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(0);
		await flush();
		expect(s.calls.map((call) => call.path)).toEqual([
			"notifications/unread-count",
			"notifications?page=0&size=20",
			"notifications/unread-count",
		]);
		s.resolveNext(envelope(s.responses.count));
		await flush();
		expect(s.calls.at(-1)!.path).toBe("notifications?page=0&size=20");
		s.resolveNext(envelope(s.responses.inbox));
		await flush();
		expect(useNotificationStore.getState()).toMatchObject({ unreadCount: 6, revision: 8 });
		expect(useNotificationStore.getState().list).toHaveLength(2);
	});

	it("keeps inbox readiness live even when a denied stock resource makes global status rest-only", async () => {
		const s = setup({ configured: true, admitInbox: true, admittedStock: [], auto: true });
		const releaseStock = s.manager.subscribeStock("denied-sku", () => {});
		cleanups.push(releaseStock);
		s.store.configure(s.manager);
		await flush();
		s.inboxChannel()!.status("SUBSCRIBED");
		await flush();
		expect(useNotificationStore.getState().readiness.status).toBe("live");
		expect(s.manager.getStatus()).toBe("rest-only");
		expect(s.manager.getInterestState({ kind: "stock", productId: "denied-sku" }).admission).toBe("denied");
	});

	it("reports a denied inbox as REST-only while an admitted stock resource stays live", async () => {
		const s = setup({ configured: true, admitInbox: false, admittedStock: ["live-sku"], auto: true });
		const releaseStock = s.manager.subscribeStock("live-sku", () => {});
		cleanups.push(releaseStock);
		s.store.configure(s.manager);
		await flush();
		expect(useNotificationStore.getState().readiness).toMatchObject({
			admission: "denied", acknowledged: false, status: "rest-only",
		});
		expect(useNotificationStore.getState().unreadCount).toBe(4);
		const stockChannel = s.channels.find((channel) => channel.topic === "stock:live-sku")!;
		stockChannel.status("SUBSCRIBED");
		await flush();
		expect(s.manager.getInterestState({ kind: "stock", productId: "live-sku" }).status).toBe("live");
		expect(useNotificationStore.getState().readiness.status).toBe("rest-only");
	});

	it("reacts to later readiness loss and rejoin without any signal", async () => {
		const s = setup({ configured: true, admitInbox: true, auto: false });
		s.store.configure(s.manager);
		await flush();
		s.resolveNext(envelope(s.responses.count));
		await flush();
		s.inboxChannel()!.status("SUBSCRIBED");
		await flush();
		expect(useNotificationStore.getState().readiness.status).toBe("live");

		s.inboxChannel()!.status("CHANNEL_ERROR");
		await flush();
		expect(useNotificationStore.getState().readiness.status).not.toBe("live");

		await vi.advanceTimersByTimeAsync(1_000);
		await flush();
		const rejoined = s.channels.at(-1)!;
		rejoined.status("SUBSCRIBED");
		await flush();
		expect(useNotificationStore.getState().readiness.status).toBe("live");
		const before = s.calls.length;
		await vi.advanceTimersByTimeAsync(0);
		await flush();
		expect(s.calls.length).toBeGreaterThan(before);
	});

	it("stays REST-only with truthful detail when Realtime is unavailable", async () => {
		const s = setup({ configured: false });
		s.store.configure(s.manager);
		await flush();
		expect(useNotificationStore.getState()).toMatchObject({
			unreadCount: 4,
			readiness: { admission: "unavailable", acknowledged: false, status: "degraded" },
		});
		expect(s.credentials).not.toHaveBeenCalled();
	});
});

describe("on-demand preview slice in the shared store", () => {
	it("loads the latest five without touching the full inbox page", async () => {
		const s = setup({ configured: false, auto: true });
		s.store.configure(s.manager);
		await flush();
		const before = s.calls.length;

		await s.store.loadPreview();
		await flush();

		expect(s.calls.at(-1)!.path).toBe("notifications?page=0&size=5");
		expect(s.calls).toHaveLength(before + 1);
		expect(useNotificationStore.getState()).toMatchObject({
			previewLoading: false, previewError: null,
			list: [], page: 0, size: 20, filter: "ALL", totalElements: 0,
		});
		expect(useNotificationStore.getState().preview).toHaveLength(1);
	});

	it("never clobbers a loaded filtered page with preview results", async () => {
		const s = setup({ configured: false, auto: true });
		s.store.configure(s.manager);
		await flush();
		await s.store.loadList({ page: 2, size: 20, filter: "UNREAD" });
		await flush();
		const full = useNotificationStore.getState();
		expect(full).toMatchObject({ page: 2, size: 20, filter: "UNREAD", listLoading: false });

		await s.store.loadPreview();
		await flush();
		const after = useNotificationStore.getState();
		expect(s.calls.at(-1)!.path).toBe("notifications?page=0&size=5");
		expect(after.page).toBe(full.page);
		expect(after.size).toBe(full.size);
		expect(after.filter).toBe(full.filter);
		expect(after.totalElements).toBe(full.totalElements);
		expect(after.list).toEqual(full.list);
		expect(after.preview).toHaveLength(1);
	});

	it("drops an in-flight preview when the account changes", async () => {
		const s = setup({ configured: false, auto: false });
		s.store.configure(s.manager);
		await flush();
		const pending = s.store.loadPreview();
		await flush();
		expect(useNotificationStore.getState().previewLoading).toBe(true);

		setUser("USR_2");
		await flush();
		expect(useNotificationStore.getState()).toMatchObject({ preview: [], previewLoading: false });

		s.resolveMatching("notifications?page=0&size=5", inboxData([row("STALE")], 9, 9));
		await pending;
		await flush();
		expect(useNotificationStore.getState().preview).toEqual([]);
	});

	it("clears preview state on dispose", async () => {
		const s = setup({ configured: false, auto: true });
		s.store.configure(s.manager);
		await flush();
		await s.store.loadPreview();
		await flush();
		expect(useNotificationStore.getState().preview).toHaveLength(1);

		s.store.dispose();
		expect(useNotificationStore.getState()).toMatchObject({
			preview: [], previewLoading: false, previewError: null,
		});
	});
});

function pendingSignal(s: ReturnType<typeof setup>, index: number): AbortSignal {
	return s.pending[index].call.init.signal as AbortSignal;
}
