import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeConnectionManager } from "./connection-manager";
import type {
	RealtimeInterest,
	RealtimeInterestState,
} from "./types";

type Frame = [string | null, string, string, string, Record<string, unknown>];

class LocalSocket extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	static sockets: LocalSocket[] = [];
	static deferJoins = false;
	static pendingJoins: Array<{ socket: LocalSocket; frame: Frame }> = [];
	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSING = 2;
	readonly CLOSED = 3;
	readyState = 0;
	bufferedAmount = 0;
	binaryType = "arraybuffer";
	protocol = "";
	extensions = "";
	onopen: ((event: Event) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	autoClose = true;
	readonly openedAt = Date.now();
	readonly frames: Array<{ at: number; frame: Frame }> = [];

	constructor(readonly url: string) {
		super();
		LocalSocket.sockets.push(this);
	}

	open() {
		this.readyState = 1;
		const event = new Event("open");
		this.dispatchEvent(event);
		this.onopen?.(event);
	}

	send(data: string) {
		expect(this.readyState).toBe(1);
		const frame = JSON.parse(data) as Frame;
		this.frames.push({ at: Date.now(), frame });
		if (frame[3] === "phx_join") {
			if (LocalSocket.deferJoins) {
				LocalSocket.pendingJoins.push({ socket: this, frame });
				return;
			}
			queueMicrotask(() => this.replyJoin(frame));
		}
	}

	replyJoin(frame: Frame) {
		this.receive([
			frame[0], frame[1], frame[2], "phx_reply", { status: "ok", response: {} },
		]);
	}

	static flushJoins(topic?: string) {
		const deferred = LocalSocket.pendingJoins;
		const ready = deferred.filter(
			({ frame }) => topic === undefined || frame[2] === `realtime:${topic}`,
		);
		LocalSocket.pendingJoins = deferred.filter(
			(entry) => !ready.includes(entry),
		);
		for (const { socket, frame } of ready) socket.replyJoin(frame);
	}

	receive(frame: Frame) {
		this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(frame) }));
	}

	broadcasts() {
		return this.frames.filter(({ frame }) => frame[3] === "broadcast");
	}

	failChannel(topic: string) {
		const joined = this.joins().find(({ frame }) => frame[2] === `realtime:${topic}`);
		expect(joined).toBeDefined();
		this.receive([joined!.frame[0], "", `realtime:${topic}`, "phx_error", {}]);
	}

	close() {
		this.readyState = 2;
		if (this.autoClose) this.finishClose();
	}

	finishClose() {
		this.readyState = 3;
		const event = new CloseEvent("close", { code: 1000 });
		this.dispatchEvent(event);
		this.onclose?.(event);
	}

	joins() {
		return this.frames.filter(({ frame }) => frame[3] === "phx_join");
	}
}

describe("installed SDK managed transport", () => {
	const managers: RealtimeConnectionManager[] = [];
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		LocalSocket.sockets = [];
		LocalSocket.deferJoins = false;
		LocalSocket.pendingJoins = [];
		vi.stubGlobal("WebSocket", LocalSocket);
	});
	afterEach(async () => {
		for (const manager of managers.splice(0)) manager.stop();
		for (const socket of LocalSocket.sockets) socket.finishClose();
		await vi.advanceTimersByTimeAsync(0);
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	function setup(
		ids = ["p1", "p2", "p3"],
		options: {
			admittedProductIds?: string[];
			inboxTopic?: string | null;
			subscribeInbox?: boolean;
		} = {},
	) {
		const leases: Array<{ at: number; token: string }> = [];
		const admittedProductIds = options.admittedProductIds ?? ids;
		const inboxTopic = options.inboxTopic ?? null;
		const fetchCredentials = vi.fn(async () => {
			const token = `lease-${leases.length + 1}`;
			leases.push({ at: Date.now(), token });
			return {
				accessToken: token,
				expiresAt: new Date(Date.now() + 300_000).toISOString(),
				admittedProductIds,
				inboxTopic,
			};
		});
		const manager = new RealtimeConnectionManager({
			env: () => ({ url: "https://local.invalid", publishableKey: "local-test-key" }),
			fetchCredentials,
			random: () => 0,
		});
		managers.push(manager);
		for (const id of ids) manager.subscribeStock(id, () => {});
		if (options.subscribeInbox) manager.subscribeInbox(() => {});
		manager.start();
		return { manager, fetchCredentials, leases };
	}

	function observe(
		manager: RealtimeConnectionManager,
		interest: RealtimeInterest,
	) {
		const states: RealtimeInterestState[] = [];
		manager.onInterestState(interest, (state) => states.push(state));
		return states;
	}

	it("spaces actual phx_join frames after a delayed transport opens", async () => {
		setup();
		await vi.advanceTimersByTimeAsync(2_000);
		expect(LocalSocket.sockets).toHaveLength(1);
		const socket = LocalSocket.sockets[0];
		expect(socket.joins()).toHaveLength(0);
		socket.open();
		await vi.advanceTimersByTimeAsync(0);
		expect(socket.joins().map(({ at }) => at)).toEqual([2_000]);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(socket.joins().map(({ at }) => at)).toEqual([2_000, 2_500, 3_000]);
	});

	it("rejects old queued joins and SDK rejoin after the first channel fails", async () => {
		const { fetchCredentials, leases } = setup();
		await vi.advanceTimersByTimeAsync(0);
		const first = LocalSocket.sockets[0];
		first.open();
		await vi.advanceTimersByTimeAsync(0);
		first.failChannel("stock:p1");
		await vi.advanceTimersByTimeAsync(999);
		expect(first.joins()).toHaveLength(1);
		expect(LocalSocket.sockets).toHaveLength(1);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(LocalSocket.sockets).toHaveLength(2);
		const second = LocalSocket.sockets[1];
		second.open();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(first.joins()).toHaveLength(1);
		expect(second.joins().map(({ at }) => at)).toEqual([1_000, 1_500, 2_000]);
		expect(second.joins().every(({ frame }) => frame[4].access_token === "lease-2")).toBe(true);
		expect(leases.map(({ token }) => token)).toEqual(["lease-1", "lease-2"]);
		expect(second.openedAt).toBeGreaterThanOrEqual(leases[1].at);
	});

	it("waits for delayed teardown after a real SDK heartbeat timeout before a fresh socket", async () => {
		const { leases } = setup(["p1"]);
		await vi.advanceTimersByTimeAsync(0);
		const first = LocalSocket.sockets[0];
		first.autoClose = false;
		first.open();
		await vi.advanceTimersByTimeAsync(50_000);
		expect(first.frames.some(({ frame }) => frame[3] === "heartbeat")).toBe(true);
		expect(first.readyState).toBe(2);
		await vi.advanceTimersByTimeAsync(2_000);
		expect(LocalSocket.sockets).toHaveLength(1);
		expect(leases).toHaveLength(1);
		first.finishClose();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(LocalSocket.sockets).toHaveLength(2);
		expect(leases).toHaveLength(2);
		expect(leases[1].at).toBeGreaterThanOrEqual(52_000);
		expect(LocalSocket.sockets[1].openedAt).toBeGreaterThanOrEqual(leases[1].at);
	});

	it("waits for delayed close before an account-switch attempt starts", async () => {
		const { manager, leases } = setup(["p1"]);
		manager.setAccount("first");
		await vi.advanceTimersByTimeAsync(0);
		const first = LocalSocket.sockets[0];
		first.autoClose = false;
		first.open();
		await vi.advanceTimersByTimeAsync(0);
		const leasesBeforeSwitch = leases.length;

		manager.setAccount("second");
		await vi.advanceTimersByTimeAsync(5_000);
		expect(LocalSocket.sockets).toHaveLength(1);
		expect(leases).toHaveLength(leasesBeforeSwitch);

		first.finishClose();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(LocalSocket.sockets).toHaveLength(2);
		expect(leases).toHaveLength(leasesBeforeSwitch + 1);
		expect(LocalSocket.sockets[1].openedAt).toBeGreaterThanOrEqual(
			leases.at(-1)?.at ?? 0,
		);
	});

	it.each(["stop", "logout"])("does not reconnect after %s during delayed teardown", async (action) => {
		const { manager, leases } = setup(["p1"]);
		manager.setAccount("first");
		await vi.advanceTimersByTimeAsync(0);
		const first = LocalSocket.sockets[0];
		first.autoClose = false;
		first.open();
		await vi.advanceTimersByTimeAsync(0);
		const leasesBeforeTeardown = leases.length;
		first.failChannel("stock:p1");
		if (action === "stop") manager.stop();
		else manager.setAccount(null);
		first.finishClose();
		await vi.advanceTimersByTimeAsync(20_000);
		expect(LocalSocket.sockets).toHaveLength(1);
		expect(leases).toHaveLength(leasesBeforeTeardown);
	});

	it("goes live from a delayed phx_reply and reconciles the changed snapshot without a Broadcast", async () => {
		LocalSocket.deferJoins = true;
		const { manager } = setup(["p1"]);
		const interest: RealtimeInterest = { kind: "stock", productId: "p1" };
		const snapshots: string[] = [];
		let source = "before";
		manager.onReconcile(() => {
			snapshots.push(source);
		});
		const states = observe(manager, interest);

		await vi.advanceTimersByTimeAsync(0);
		const socket = LocalSocket.sockets[0];
		socket.open();
		await vi.advanceTimersByTimeAsync(0);
		expect(socket.joins()).toHaveLength(1);
		expect(states.at(-1)).toEqual({
			admission: "admitted",
			acknowledged: false,
			status: "connecting",
		});

		// An availability read before ACK is not the post-ACK snapshot barrier.
		manager.notifyVisibilityChange();
		await vi.advanceTimersByTimeAsync(0);
		expect(snapshots).toEqual(["before"]);

		source = "after";
		LocalSocket.flushJoins("stock:p1");
		await vi.advanceTimersByTimeAsync(0);

		expect(states.at(-1)).toEqual({
			admission: "admitted",
			acknowledged: true,
			status: "live",
		});
		expect(manager.getStatus()).toBe("live");
		expect(snapshots).toEqual(["before", "after"]);
		expect(socket.broadcasts()).toHaveLength(0);
		socket.replyJoin(socket.joins()[0].frame);
		await vi.advanceTimersByTimeAsync(0);
		expect(snapshots).toEqual(["before", "after"]);
	});

	it("keeps mixed admission independent with the aggregate rest-only", async () => {
		LocalSocket.deferJoins = true;
		const { manager } = setup(["p1", "p2"], {
			admittedProductIds: ["p1"],
			subscribeInbox: true,
			inboxTopic: null,
		});
		const admitted = observe(manager, { kind: "stock", productId: "p1" });
		const denied = observe(manager, { kind: "stock", productId: "p2" });
		const guestInbox = observe(manager, { kind: "inbox" });

		await vi.advanceTimersByTimeAsync(0);
		const socket = LocalSocket.sockets[0];
		socket.open();
		await vi.advanceTimersByTimeAsync(0);
		LocalSocket.flushJoins("stock:p1");
		await vi.advanceTimersByTimeAsync(0);

		expect(admitted.at(-1)).toEqual({
			admission: "admitted",
			acknowledged: true,
			status: "live",
		});
		expect(denied.at(-1)).toEqual({
			admission: "denied",
			acknowledged: false,
			status: "rest-only",
		});
		expect(guestInbox.at(-1)).toEqual({
			admission: "denied",
			acknowledged: false,
			status: "rest-only",
		});
		expect(manager.getStatus()).toBe("rest-only");
	});

	it("goes live on a later rejoin ACK without a Broadcast", async () => {
		LocalSocket.deferJoins = true;
		const { manager } = setup(["p1"]);
		const interest: RealtimeInterest = { kind: "stock", productId: "p1" };
		const states = observe(manager, interest);
		const snapshots: string[] = [];
		manager.onReconcile(() => {
			snapshots.push("snapshot");
		});

		await vi.advanceTimersByTimeAsync(0);
		const first = LocalSocket.sockets[0];
		first.open();
		await vi.advanceTimersByTimeAsync(0);
		LocalSocket.flushJoins("stock:p1");
		await vi.advanceTimersByTimeAsync(0);
		expect(states.at(-1)?.status).toBe("live");
		const reconcilesAfterFirstAck = snapshots.length;

		first.failChannel("stock:p1");
		expect(states.at(-1)).toEqual({
			admission: "pending",
			acknowledged: false,
			status: "connecting",
		});

		await vi.advanceTimersByTimeAsync(1_000);
		const second = LocalSocket.sockets[1];
		second.open();
		await vi.advanceTimersByTimeAsync(0);
		expect(states.at(-1)).toEqual({
			admission: "admitted",
			acknowledged: false,
			status: "connecting",
		});

		const reconcilesBeforeRejoinAck = snapshots.length;
		LocalSocket.flushJoins("stock:p1");
		await vi.advanceTimersByTimeAsync(0);
		expect(states.at(-1)).toEqual({
			admission: "admitted",
			acknowledged: true,
			status: "live",
		});
		expect(snapshots.length).toBeGreaterThan(reconcilesAfterFirstAck);
		expect(snapshots).toHaveLength(reconcilesBeforeRejoinAck + 1);
		expect(first.broadcasts()).toHaveLength(0);
		expect(second.broadcasts()).toHaveLength(0);
	});

	it("ignores a stale old-channel ACK after an account switch", async () => {
		LocalSocket.deferJoins = true;
		const { manager } = setup(["p1"]);
		const interest: RealtimeInterest = { kind: "stock", productId: "p1" };
		const states = observe(manager, interest);
		const reconcile = vi.fn();
		manager.onReconcile(reconcile);

		await vi.advanceTimersByTimeAsync(0);
		const first = LocalSocket.sockets[0];
		first.autoClose = false;
		first.open();
		await vi.advanceTimersByTimeAsync(0);
		expect(first.joins()).toHaveLength(1);

		manager.setAccount("second");
		expect(states.at(-1)).toEqual({
			admission: "pending",
			acknowledged: false,
			status: "connecting",
		});

		LocalSocket.flushJoins("stock:p1");
		await vi.advanceTimersByTimeAsync(0);
		expect(manager.getInterestState(interest).acknowledged).toBe(false);
		expect(states.at(-1)?.status).not.toBe("live");
		expect(reconcile).not.toHaveBeenCalled();

		first.finishClose();
		await vi.advanceTimersByTimeAsync(1_000);
		const second = LocalSocket.sockets[1];
		expect(second).toBeDefined();
		second.open();
		await vi.advanceTimersByTimeAsync(0);
		LocalSocket.flushJoins("stock:p1");
		await vi.advanceTimersByTimeAsync(0);
		expect(states.at(-1)).toEqual({
			admission: "admitted",
			acknowledged: true,
			status: "live",
		});
	});

	it("ignores a stale old-channel ACK after stop", async () => {
		LocalSocket.deferJoins = true;
		const { manager } = setup(["p1"]);
		const interest: RealtimeInterest = { kind: "stock", productId: "p1" };
		const states = observe(manager, interest);
		const reconcile = vi.fn();
		manager.onReconcile(reconcile);

		await vi.advanceTimersByTimeAsync(0);
		const socket = LocalSocket.sockets[0];
		socket.open();
		await vi.advanceTimersByTimeAsync(0);
		expect(socket.joins()).toHaveLength(1);

		manager.stop();
		const stopped = states.at(-1);
		expect(stopped).toEqual({
			admission: "unavailable",
			acknowledged: false,
			status: "disabled",
		});

		LocalSocket.flushJoins("stock:p1");
		await vi.advanceTimersByTimeAsync(0);
		expect(states.at(-1)).toEqual(stopped);
		expect(manager.getInterestState(interest).acknowledged).toBe(false);
		expect(manager.getStatus()).not.toBe("live");
		expect(reconcile).not.toHaveBeenCalled();
	});
});
