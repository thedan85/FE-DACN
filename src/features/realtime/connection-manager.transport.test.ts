import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeConnectionManager } from "./connection-manager";

type Frame = [string | null, string, string, string, Record<string, unknown>];

class LocalSocket extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	static sockets: LocalSocket[] = [];
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
			queueMicrotask(() => this.receive([
				frame[0], frame[1], frame[2], "phx_reply", { status: "ok", response: {} },
			]));
		}
	}

	receive(frame: Frame) {
		this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(frame) }));
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
		vi.stubGlobal("WebSocket", LocalSocket);
	});
	afterEach(async () => {
		for (const manager of managers.splice(0)) manager.stop();
		for (const socket of LocalSocket.sockets) socket.finishClose();
		await vi.advanceTimersByTimeAsync(0);
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	function setup(ids = ["p1", "p2", "p3"]) {
		const leases: Array<{ at: number; token: string }> = [];
		const fetchCredentials = vi.fn(async () => {
			const token = `lease-${leases.length + 1}`;
			leases.push({ at: Date.now(), token });
			return {
				accessToken: token,
				expiresAt: new Date(Date.now() + 300_000).toISOString(),
				admittedProductIds: ids,
				inboxTopic: null,
			};
		});
		const manager = new RealtimeConnectionManager({
			env: () => ({ url: "https://local.invalid", publishableKey: "local-test-key" }),
			fetchCredentials,
			random: () => 0,
		});
		managers.push(manager);
		for (const id of ids) manager.subscribeStock(id, () => {});
		manager.start();
		return { manager, fetchCredentials, leases };
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
});
