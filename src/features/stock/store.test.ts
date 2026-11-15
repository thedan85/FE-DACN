import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RealtimeConnectionManager } from "@/features/realtime/connection-manager";
import { JoinScheduler } from "@/features/realtime/join-scheduler";
import { getSessionGeneration, setAccessToken, updateAccessToken, clearSession } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";
import { createStockStore } from "./store";
import type { StockSnapshotInterest } from "./schema";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
	...await original<typeof import("@/lib/api/client")>(), apiFetch: apiFetchMock,
}));
type Input = { productIds: string[]; variantIds: string[] };
type Call = { input: Input; signal: AbortSignal };
const product = (productId: string): StockSnapshotInterest => ({ kind: "product", productId });
const variant = (variantId: string, productId = "parent"): StockSnapshotInterest =>
	({ kind: "variant", variantId, productId });
const payload = (input: Input, stock = 5) => ({
	code: 200, message: "OK", data: {
		products: input.productIds.map((productId) => ({ productId, stock })),
		variants: input.variantIds.map((variantId) => ({ variantId, productId: "parent", stock, stockRevision: stock })),
	},
});
const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
};
async function flush() {
	for (let i = 0; i < 60; i += 1) await Promise.resolve();
}

describe("shared stock store with accepted real manager", () => {
	const cleanups: Array<() => void> = [];
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		clearSession();
		useAuthStore.setState({ user: null, status: "anonymous", sessionReady: true });
		apiFetchMock.mockReset();
	});
	afterEach(() => {
		for (const cleanup of cleanups.splice(0).reverse()) cleanup();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	function setup(options: { configured?: boolean; admitted?: string[]; auto?: boolean } = {}) {
		const channels: Array<{
			topic: string;
			status: (value: string) => void;
			hint: () => void;
		}> = [];
		const createClient = vi.fn(() => ({
			realtime: { setAuth: vi.fn(), disconnect: vi.fn() },
			removeChannel: vi.fn(),
			channel: (topic: string) => {
				const created = { topic, status: (_: string) => { void _; }, hint: () => {} };
				channels.push(created);
				return {
					on: (_type: string, _filter: unknown, listener: () => void) => { created.hint = listener; },
					subscribe: (listener: (value: string) => void) => { created.status = listener; },
				};
			},
		}) as unknown as SupabaseClient);
		const credentials = vi.fn(async (ids: string[]) => ({
			accessToken: "local-controlled-token",
			expiresAt: new Date(Date.now() + 300_000).toISOString(),
			admittedProductIds: options.admitted ?? ids, inboxTopic: null,
		}));
		const manager = new RealtimeConnectionManager({
			env: () => options.configured === false ? null : { url: "https://local.invalid", publishableKey: "local" },
			createClient, fetchCredentials: credentials, random: () => 0,
			joinScheduler: new JoinScheduler(() => 0, 0),
		});
		manager.start();
		cleanups.push(() => manager.stop());
		const store = createStockStore(manager);
		const calls: Call[] = [];
		let active = 0;
		let maximum = 0;
		const pending: ReturnType<typeof deferred<unknown>>[] = [];
		apiFetchMock.mockImplementation(async (_path: string, init: RequestInit) => {
			const input = JSON.parse(String(init.body)) as Input;
			calls.push({ input, signal: init.signal as AbortSignal });
			active += 1;
			maximum = Math.max(maximum, active);
			try {
				if (options.auto !== false) return payload(input);
				const request = deferred<unknown>();
				pending.push(request);
				return await request.promise;
			} finally { active -= 1; }
		});
		const register = (interest: StockSnapshotInterest) => {
			const release = store.register(interest);
			cleanups.push(release);
			return release;
		};
		return { manager, store, calls, pending, channels, credentials, createClient, register, maximum: () => maximum };
	}

	it("coalesces shared product/variant roles and duplicate consumers before HTTP", async () => {
		const s = setup({ configured: false });
		const subscribe = vi.spyOn(s.manager, "subscribeStock");
		const reconcile = vi.spyOn(s.manager, "onReconcile");
		const observe = vi.spyOn(s.manager, "onInterestState");
		const a = s.register(product("parent"));
		s.register(product("parent"));
		s.register(variant("v"));
		await flush();
		expect(s.calls.map((c) => c.input)).toEqual([{ productIds: ["parent"], variantIds: ["v"] }]);
		expect(subscribe).toHaveBeenCalledTimes(1);
		expect(reconcile).toHaveBeenCalledTimes(1);
		expect(observe).toHaveBeenCalledTimes(1);
		expect(subscribe.mock.invocationCallOrder[0]).toBeLessThan(apiFetchMock.mock.invocationCallOrder[0]);
		expect(observe.mock.invocationCallOrder[0]).toBeLessThan(apiFetchMock.mock.invocationCallOrder[0]);
		a();
		await flush();
		expect(s.store.getSnapshot(product("parent")).stock).toBe(5);
		expect(s.calls).toHaveLength(1);
	});

	it("takes a new read after delayed ACK without Broadcast and reports only ACKed parents live", async () => {
		const s = setup({ admitted: ["parent"] });
		s.register(variant("v"));
		s.register(product("denied"));
		await flush();
		expect(s.store.getSnapshot(variant("v")).stock).toBe(5);
		expect(s.store.getSnapshot(variant("v")).readiness.acknowledged).toBe(false);
		expect(s.store.getSnapshot(product("denied")).readiness.admission).toBe("denied");
		apiFetchMock.mockImplementation(async (_: string, init: RequestInit) => payload(JSON.parse(String(init.body)), 9));
		s.channels.find((c) => c.topic === "stock:parent")!.status("SUBSCRIBED");
		expect(s.store.getSnapshot(variant("v")).readiness.status).toBe("live");
		expect(s.manager.getStatus()).toBe("rest-only");
		await vi.advanceTimersByTimeAsync(0);
		await flush();
		expect(s.store.getSnapshot(variant("v")).stock).toBe(9);
		expect(s.store.getSnapshot(product("denied")).stock).toBe(9);
		expect(s.maximum()).toBe(1);
	});

	it("reacts to readiness loss, renewal and rejoin without hints or direct listener HTTP", async () => {
		const s = setup();
		s.register(product("parent"));
		await flush();
		s.channels[0].status("SUBSCRIBED");
		await vi.advanceTimersByTimeAsync(0);
		await flush();
		expect(s.store.getSnapshot(product("parent")).readiness.status).toBe("live");
		await vi.advanceTimersByTimeAsync(270_000);
		await flush();
		expect(s.credentials.mock.calls.length).toBeGreaterThan(1);
		s.channels.at(-1)!.status("CHANNEL_ERROR");
		expect(s.store.getSnapshot(product("parent")).readiness.status).not.toBe("live");
		await vi.advanceTimersByTimeAsync(1_000);
		await flush();
		const before = apiFetchMock.mock.calls.length;
		s.channels.at(-1)!.status("SUBSCRIBED");
		expect(apiFetchMock).toHaveBeenCalledTimes(before);
		expect(s.store.getSnapshot(product("parent")).readiness.status).toBe("live");
		await vi.advanceTimersByTimeAsync(0);
		await flush();
		expect(apiFetchMock.mock.calls.length).toBeGreaterThan(before);
	});

	it("partitions exactly one product and 100 variants into 100+1 without requesting the variant parent total", async () => {
		const s = setup({ configured: false });
		s.register(product("A"));
		for (let i = 0; i < 100; i += 1) {
			s.register(variant(`v${String(i).padStart(3, "0")}`));
		}
		s.register(variant("v000"));
		await flush();
		expect(s.calls.map(({ input }) => new Set([...input.productIds, ...input.variantIds]).size)).toEqual([100, 1]);
		expect(s.calls[0].input.productIds).toEqual(["A"]);
		expect(s.calls[1].input).toEqual({ productIds: [], variantIds: ["v099"] });
		expect(s.maximum()).toBe(1);
	});

	it("covers several full batches once in exact code-unit order and keeps shared ID roles together", async () => {
		const s = setup({ configured: false });
		const ids = ["z", "Z", "ä", "_", "same", ...Array.from({ length: 298 }, (_, i) => `v${String(i).padStart(3, "0")}`)];
		for (const id of ids) s.register(variant(id));
		s.register(product("same"));
		await flush();
		const observed = s.calls.flatMap(({ input }) => [...new Set([...input.productIds, ...input.variantIds])].sort());
		expect(observed).toEqual([...ids].sort());
		expect(s.calls.map(({ input }) => new Set([...input.productIds, ...input.variantIds]).size)).toEqual([100, 100, 100, 3]);
		expect(s.calls.find(({ input }) => input.productIds.includes("same"))!.input.variantIds).toContain("same");
		expect(s.maximum()).toBe(1);
	});

	it("clears omissions only in the requested chunk/role and never derives product revision", async () => {
		const s = setup({ configured: false });
		s.register(product("same"));
		s.register(variant("same"));
		for (let i = 0; i < 100; i += 1) s.register(product(`z${i}`));
		await flush();
		expect(s.store.getSnapshot(product("same")).stockRevision).toBeNull();
		apiFetchMock.mockImplementation(async (_: string, init: RequestInit) => {
			const input = JSON.parse(String(init.body)) as Input;
			const result = payload(input, 2);
			if (input.productIds.includes("same")) result.data.products = [];
			return result;
		});
		s.manager.notifyVisibilityChange();
		await flush();
		expect(s.store.getSnapshot(product("same"))).toMatchObject({ stock: null, omitted: true });
		expect(s.store.getSnapshot(variant("same"))).toMatchObject({ stock: 2, stockRevision: 2, omitted: false });
		expect(s.store.getSnapshot(product("z99")).stock).toBe(2);
	});

	it("awaits complete follow-up waves when reconciliation arrives during registration work, including another invalidation", async () => {
		const s = setup({ configured: false, auto: false });
		for (let i = 0; i < 201; i += 1) s.register(product(`p${String(i).padStart(3, "0")}`));
		await flush();
		s.pending[0].resolve(payload(s.calls[0].input, 1));
		await flush();
		expect(s.calls).toHaveLength(2);
		const laterListener = vi.fn();
		s.manager.onReconcile(laterListener);
		s.manager.notifyVisibilityChange();
		await flush();
		expect(laterListener).not.toHaveBeenCalled();
		s.pending[1].resolve(payload(s.calls[1].input, 1));
		await flush();
		s.pending[2].resolve(payload(s.calls[2].input, 1));
		await flush();
		expect(s.calls).toHaveLength(4);
		expect(laterListener).not.toHaveBeenCalled();
		s.pending[3].resolve(payload(s.calls[3].input, 2));
		await flush();
		s.manager.notifyVisibilityChange();
		s.pending[4].resolve(payload(s.calls[4].input, 2));
		await flush();
		s.pending[5].resolve(payload(s.calls[5].input, 2));
		await flush();
		await vi.advanceTimersByTimeAsync(0);
		await flush();
		expect(s.calls).toHaveLength(7);
		for (let i = 6; i < 9; i += 1) {
			s.pending[i].resolve(payload(s.calls[i].input, 3));
			await flush();
		}
		expect(s.calls).toHaveLength(9);
		expect(s.store.getSnapshot(product("p000")).stock).toBe(3);
		expect(s.maximum()).toBe(1);
	});

	it.each(["resource", "account"] as const)(
		"aborts a stale first chunk on %s replacement, waits for physical settlement and discards the stale queue",
		async (reason) => {
			const s = setup({ configured: false, auto: false });
			const releases = Array.from({ length: 201 }, (_, i) => s.register(product(`old${i}`)));
			await flush();
			if (reason === "account") {
				useAuthStore.setState({ user: {
					userId: "replacement", email: "local@example.invalid", name: "Local fixture",
					phone: null, address: null, roleCode: "Customer", roleName: "Customer",
					permissions: [], hasPassword: true,
				}, status: "authenticated" });
			}
			for (const release of releases) release();
			s.register(product("new"));
			expect(s.calls[0].signal.aborted).toBe(true);
			await flush();
			expect(s.calls).toHaveLength(1);
			s.pending[0].resolve(payload(s.calls[0].input, 999));
			await flush();
			expect(s.calls.map((c) => c.input)).toHaveLength(2);
			expect(s.calls[1].input).toEqual({ productIds: ["new"], variantIds: [] });
			expect(s.store.getSnapshot(product("old0")).stock).toBeNull();
			s.pending[1].resolve(payload(s.calls[1].input, 7));
			await flush();
			expect(s.store.getSnapshot(product("new")).stock).toBe(7);
			expect(s.maximum()).toBe(1);
		},
	);

	it("fences foundation context abort even when HTTP ignores cancellation", async () => {
		const s = setup({ configured: false, auto: false });
		s.register(product("p"));
		await flush();
		s.pending[0].resolve(payload(s.calls[0].input, 1));
		await flush();
		s.manager.notifyVisibilityChange();
		await flush();
		s.manager.setAccount("other");
		expect(s.calls[1].signal.aborted).toBe(true);
		s.pending[1].resolve(payload(s.calls[1].input, 999));
		await flush();
		expect(s.store.getSnapshot(product("p")).stock).toBe(1);
	});

	it("invalidates an earlier chunk with real hints during later chunks and repeats the full follow-up after another hint", async () => {
		const s = setup({ auto: false, admitted: ["parent"] });
		for (let i = 0; i < 201; i += 1) s.register(variant(`v${String(i).padStart(3, "0")}`));
		await flush();
		s.channels[0].status("SUBSCRIBED");
		await vi.advanceTimersByTimeAsync(0);
		// ACK fences registration work. Its abort-ignoring HTTP must settle first.
		expect(s.calls).toHaveLength(1);
		s.pending[0].resolve(payload(s.calls[0].input, 0));
		await flush();
		expect(s.calls).toHaveLength(2);
		s.pending[1].resolve(payload(s.calls[1].input, 1));
		await flush();
		expect(s.store.getSnapshot(variant("v000")).stock).toBe(1);
		expect(s.calls).toHaveLength(3);
		s.channels[0].hint();
		expect(s.calls[2].signal.aborted).toBe(true);
		s.pending[2].resolve(payload(s.calls[2].input, 999));
		await flush();
		await vi.advanceTimersByTimeAsync(0);
		await flush();
		expect(s.calls[3].input.variantIds[0]).toBe("v000");
		s.pending[3].resolve(payload(s.calls[3].input, 2));
		await flush();
		s.channels[0].hint();
		s.pending[4].resolve(payload(s.calls[4].input, 999));
		await flush();
		await vi.advanceTimersByTimeAsync(0);
		await flush();
		expect(s.calls[5].input.variantIds[0]).toBe("v000");
		for (let i = 5; i < 8; i += 1) {
			s.pending[i].resolve(payload(s.calls[i].input, 3));
			await flush();
		}
		expect(s.calls.map(({ input }) => input.variantIds.length)).toEqual([100, 100, 100, 100, 100, 100, 100, 1]);
		expect(s.store.getSnapshot(variant("v000")).stock).toBe(3);
		expect(s.store.getSnapshot(variant("v200")).stock).toBe(3);
		expect(s.maximum()).toBe(1);
	});

	it("handles synchronous readiness reentry with one credential flight and one physical stock request", async () => {
		const s = setup();
		s.register(product("parent"));
		await flush();
		s.channels[0].status("SUBSCRIBED");
		await vi.advanceTimersByTimeAsync(0);
		await flush();
		let added = false;
		const unsubscribe = s.store.subscribe(() => {
			if (added || s.store.getSnapshot(product("parent")).readiness.admission !== "pending") return;
			added = true;
			s.register(product("third"));
		});
		cleanups.push(unsubscribe);
		s.register(product("second"));
		await flush();
		expect(added).toBe(true);
		expect(s.calls.at(-1)!.input.productIds).toEqual(["parent", "second", "third"]);
		expect(s.store.getSnapshot(product("third")).readiness.admission).toBe("admitted");
		expect(s.credentials.mock.calls.at(-1)![0]).toEqual(["parent", "second", "third"]);
		expect(s.maximum()).toBe(1);
	});

	it("retains known data on malformed/network failure, then recovers through foundation scheduling", async () => {
		const s = setup({ configured: false });
		s.register(product("p"));
		await flush();
		apiFetchMock.mockResolvedValueOnce({ code: 200, message: "OK", data: { products: [] } });
		s.manager.notifyVisibilityChange();
		await flush();
		expect(s.store.getSnapshot(product("p"))).toMatchObject({ stock: 5, loading: false, error: { status: 500 } });
		apiFetchMock.mockRejectedValueOnce(new Error("offline"));
		s.manager.notifyVisibilityChange();
		await flush();
		expect(s.store.getSnapshot(product("p"))).toMatchObject({ stock: 5, error: { message: "offline" } });
		await vi.advanceTimersByTimeAsync(30_000);
		await flush();
		expect(s.store.getSnapshot(product("p"))).toMatchObject({ stock: 5, error: null });
	});

	it("adds no timers or sockets without config; last release removes only owned refs/listeners", async () => {
		const s = setup({ configured: false });
		const count = vi.getTimerCount();
		const other = vi.fn();
		s.manager.subscribeStock("unrelated", other);
		const release = s.register(variant("v"));
		const duplicate = s.register(variant("v"));
		await flush();
		expect(vi.getTimerCount()).toBe(count);
		expect(s.createClient).not.toHaveBeenCalled();
		expect(s.store.getSnapshot(variant("v")).readiness).toMatchObject({ admission: "unavailable", status: "degraded" });
		const state = s.store.getSnapshot(variant("v"));
		expect(s.store.getSnapshot(variant("v"))).toBe(state);
		release();
		await flush();
		expect(s.calls).toHaveLength(1);
		duplicate();
		duplicate();
		await flush();
		s.manager.notifyVisibilityChange();
		await flush();
		expect(s.calls).toHaveLength(1);
		expect(s.manager.getInterestState({ kind: "stock", productId: "unrelated" }).status).toBe("degraded");
		expect(s.store.getSnapshot(variant("v")).stock).toBeNull();
	});

	it("keeps refreshed-session requests current but clears same-resource data synchronously on account replacement", async () => {
		setAccessToken("original");
		const s = setup({ configured: false, auto: false });
		s.register(product("p"));
		await flush();
		const generation = getSessionGeneration();
		expect(updateAccessToken("refresh", generation)).toBe(true);
		s.pending[0].resolve(payload(s.calls[0].input, 4));
		await flush();
		expect(s.store.getSnapshot(product("p")).stock).toBe(4);
		setAccessToken("other-session");
		useAuthStore.setState({ status: "authenticated" });
		expect(s.store.getSnapshot(product("p")).stock).toBeNull();
		await flush();
		s.pending[1].resolve(payload(s.calls[1].input, 8));
		await flush();
		expect(s.store.getSnapshot(product("p")).stock).toBe(8);
	});
});
