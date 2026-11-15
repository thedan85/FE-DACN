import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	type Mock,
} from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RealtimeConnectionManager } from "./connection-manager";
import type { RealtimeCredential } from "./schema";
import type {
	RealtimeInterest,
	RealtimeInterestState,
	ReconcileContext,
} from "./types";

const NOW = 1_000_000;

type CredentialFetcher = (productIds: string[]) => Promise<RealtimeCredential>;

function credential(
	expiresAt: number,
	overrides: Partial<RealtimeCredential> = {},
): RealtimeCredential {
	return {
		accessToken: "token",
		expiresAt: new Date(expiresAt).toISOString(),
		admittedProductIds: [],
		inboxTopic: null,
		...overrides,
	};
}

function createFakeClient() {
	const channels: Array<{
		topic: string;
		on: ReturnType<typeof vi.fn>;
		subscribe: ReturnType<typeof vi.fn>;
	}> = [];
	const channel = vi.fn((topic: string) => {
		const created = {
			topic,
			on: vi.fn(),
			subscribe: vi.fn(),
		};
		channels.push(created);
		return created;
	});
	const removed: string[] = [];
	const removeChannel = vi.fn(async (channel: { topic: string }) => {
		removed.push(channel.topic);
	});
	const setAuth = vi.fn();
	const disconnect = vi.fn();
	const client = {
		realtime: { setAuth, disconnect },
		channel,
		removeChannel,
	};

	return {
		client: client as unknown as SupabaseClient,
		channels,
		channel,
		removeChannel,
		removed,
		setAuth,
		disconnect,
	};
}

describe("RealtimeConnectionManager lifecycle", () => {
	let fake: ReturnType<typeof createFakeClient>;

	beforeEach(() => {
		vi.useFakeTimers();
		fake = createFakeClient();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	function manager(
		fetchCredentials: Mock<CredentialFetcher>,
		overrides: Record<string, unknown> = {},
	) {
		return new RealtimeConnectionManager({
			env: () => ({
				url: "https://project.supabase.co",
				publishableKey: "pk",
			}),
			fetchCredentials,
			createClient: () => fake.client,
			now: () => NOW,
			random: () => 0,
			...overrides,
		});
	}

	it("renews the lease 30 seconds before expiry", async () => {
		const fetchCredentials = vi
			.fn()
			.mockResolvedValueOnce(
				credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
			)
			.mockResolvedValue(
				credential(NOW + 600_000, { admittedProductIds: ["p1"] }),
			);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(269_999);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);

		instance.stop();
	});

	it("reconnects with a fresh lease after the capped backoff", async () => {
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
		);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);

		const onSubscribe = fake.channels[0].subscribe.mock.calls[0][0];
		onSubscribe("CHANNEL_ERROR");
		await vi.advanceTimersByTimeAsync(999);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);

		instance.stop();
	});

	it("pauses reconciliation while hidden and reconciles once when visible", async () => {
		let visibility: DocumentVisibilityState = "visible";
		const instance = manager(vi.fn<CredentialFetcher>(), {
			visibility: () => visibility,
		});
		const reconcile = vi.fn();
		instance.onReconcile(reconcile);
		instance.start();

		await vi.advanceTimersByTimeAsync(30_000);
		expect(reconcile).toHaveBeenCalledTimes(1);

		visibility = "hidden";
		instance.notifyVisibilityChange();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(reconcile).toHaveBeenCalledTimes(1);

		visibility = "visible";
		instance.notifyVisibilityChange();
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).toHaveBeenCalledTimes(2);

		instance.stop();
	});

	it("coalesces duplicate signals into one follow-up reconcile", async () => {
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
		);
		const instance = manager(fetchCredentials);
		const reconcile = vi.fn();
		instance.onReconcile(reconcile);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);

		const onBroadcast = fake.channels[0].on.mock.calls[0][2];
		onBroadcast({ payload: {} });
		onBroadcast({ payload: {} });
		await vi.advanceTimersByTimeAsync(0);

		expect(reconcile).toHaveBeenCalledTimes(1);
		instance.stop();
	});

	it("closes channels and the socket when switching between two accounts", async () => {
		const fetchCredentials = vi
			.fn<CredentialFetcher>()
			.mockResolvedValueOnce(
				credential(NOW + 300_000, {
					accessToken: "token-1",
					admittedProductIds: ["p1"],
				}),
			)
			.mockResolvedValueOnce(
				credential(NOW + 300_000, {
					accessToken: "token-2",
					admittedProductIds: ["p1"],
				}),
			);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.setAccount("customer-1");
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.channel).toHaveBeenCalledTimes(1);
		expect(fake.setAuth).toHaveBeenLastCalledWith("token-1");

		instance.setAccount("customer-2");
		await vi.advanceTimersByTimeAsync(0);

		expect(fake.removeChannel).toHaveBeenCalledTimes(1);
		expect(fake.disconnect).toHaveBeenCalledTimes(1);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		expect(fake.setAuth).toHaveBeenLastCalledWith("token-2");
		expect(fake.setAuth.mock.calls.some((args) => args.length === 0)).toBe(
			false,
		);
		expect(fake.channel).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(500);
		expect(fake.channel).toHaveBeenCalledTimes(2);
		expect(fake.channels[1].topic).toBe("stock:p1");

		instance.stop();
	});

	it("reconciles on the browser visibilitychange event and reschedules", async () => {
		let visibility: DocumentVisibilityState = "visible";
		const instance = manager(vi.fn<CredentialFetcher>(), {
			visibility: () => visibility,
		});
		const reconcile = vi.fn();
		instance.onReconcile(reconcile);
		instance.start();

		await vi.advanceTimersByTimeAsync(30_000);
		expect(reconcile).toHaveBeenCalledTimes(1);

		visibility = "hidden";
		document.dispatchEvent(new Event("visibilitychange"));
		await vi.advanceTimersByTimeAsync(60_000);
		expect(reconcile).toHaveBeenCalledTimes(1);

		visibility = "visible";
		document.dispatchEvent(new Event("visibilitychange"));
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).toHaveBeenCalledTimes(2);

		instance.stop();
	});

	it("resets the periodic deadline when the tab becomes visible", async () => {
		const instance = manager(vi.fn<CredentialFetcher>(), {
			visibility: () => "visible",
		});
		const reconcile = vi.fn();
		instance.onReconcile(reconcile);
		instance.start();

		await vi.advanceTimersByTimeAsync(10_000);
		instance.notifyVisibilityChange();
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(20_000);
		expect(reconcile).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(10_000);
		expect(reconcile).toHaveBeenCalledTimes(2);

		instance.stop();
	});

	it("removes the visibilitychange listener when stopped", () => {
		const add = vi.spyOn(document, "addEventListener");
		const remove = vi.spyOn(document, "removeEventListener");
		const instance = manager(vi.fn<CredentialFetcher>());

		instance.start();
		expect(add).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

		instance.stop();
		expect(remove).toHaveBeenCalledWith(
			"visibilitychange",
			expect.any(Function),
		);
	});

	it("runs exactly one follow-up when signals arrive during a reconcile", async () => {
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
		);
		const instance = manager(fetchCredentials);
		const pending: Array<() => void> = [];
		const reconcile = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					pending.push(resolve);
				}),
		);
		instance.onReconcile(reconcile);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);

		await vi.advanceTimersByTimeAsync(30_000);
		expect(reconcile).toHaveBeenCalledTimes(1);
		expect(pending).toHaveLength(1);

		const onBroadcast = fake.channels[0].on.mock.calls[0][2];
		onBroadcast({ payload: {} });
		onBroadcast({ payload: {} });
		onBroadcast({ payload: {} });
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).toHaveBeenCalledTimes(1);

		pending[0]();
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).toHaveBeenCalledTimes(2);
		expect(pending).toHaveLength(2);

		pending[1]();
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).toHaveBeenCalledTimes(2);

		instance.stop();
	});

	it("discards a reconcile cycle that finishes after an account switch", async () => {
		const instance = manager(vi.fn<CredentialFetcher>());
		const pending: Array<() => void> = [];
		const reconcile = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					pending.push(resolve);
				}),
		);
		instance.onReconcile(reconcile);
		instance.start();

		await vi.advanceTimersByTimeAsync(30_000);
		expect(pending).toHaveLength(1);

		instance.notifyVisibilityChange();
		instance.setAccount("2");
		pending[0]();
		await vi.advanceTimersByTimeAsync(0);

		expect(reconcile).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(30_000);
		expect(reconcile).toHaveBeenCalledTimes(2);

		pending[1]();
		await vi.advanceTimersByTimeAsync(0);
		instance.stop();
	});

	it("discards a credential requested by the previous account", async () => {
		const pending: Array<(value: RealtimeCredential) => void> = [];
		const fetchCredentials = vi.fn<CredentialFetcher>(
			() => new Promise<RealtimeCredential>((resolve) => pending.push(resolve)),
		);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(pending).toHaveLength(1);

		instance.setAccount("2");
		pending[0](
			credential(NOW + 300_000, {
				accessToken: "old",
				admittedProductIds: ["p1"],
			}),
		);
		await vi.advanceTimersByTimeAsync(0);

		expect(fake.client.realtime.setAuth).not.toHaveBeenCalledWith("old");
		expect(fake.channel).not.toHaveBeenCalled();
		expect(pending).toHaveLength(2);

		pending[1](
			credential(NOW + 300_000, {
				accessToken: "new",
				admittedProductIds: ["p1"],
			}),
		);
		await vi.advanceTimersByTimeAsync(0);

		expect(fake.client.realtime.setAuth).toHaveBeenCalledWith("new");
		expect(fake.channel).toHaveBeenCalledTimes(1);
		instance.stop();
	});

	it("disconnects the socket and never wipes auth with an empty setAuth on logout", async () => {
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 300_000, {
				accessToken: "token-1",
				admittedProductIds: ["p1"],
			}),
		);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.setAccount("customer-1");
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.channel).toHaveBeenCalledTimes(1);
		expect(fake.setAuth).toHaveBeenLastCalledWith("token-1");
		const disconnectsBeforeLogout = fake.disconnect.mock.calls.length;
		const removalsBeforeLogout = fake.removeChannel.mock.calls.length;

		instance.setAccount(null);

		expect(fake.disconnect).toHaveBeenCalledTimes(
			disconnectsBeforeLogout + 1,
		);
		expect(fake.removeChannel).toHaveBeenCalledTimes(
			removalsBeforeLogout + 1,
		);
		expect(fake.setAuth.mock.calls.some((args) => args.length === 0)).toBe(
			false,
		);
		instance.stop();
	});

	it("keeps shared REST reconciliation while Realtime env is absent", async () => {
		let visibility: DocumentVisibilityState = "visible";
		const fetchCredentials = vi.fn<CredentialFetcher>();
		const createClient = vi.fn(() => fake.client);
		const instance = new RealtimeConnectionManager({
			env: () => null,
			fetchCredentials,
			createClient,
			visibility: () => visibility,
			now: () => NOW,
			random: () => 0,
		});
		const reconcile = vi.fn();
		instance.onReconcile(reconcile);
		instance.start();
		instance.setAccount("customer-1");
		instance.setAccount(null);

		expect(instance.getStatus()).toBe("degraded");
		await vi.advanceTimersByTimeAsync(30_000);
		expect(reconcile).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(30_000);
		expect(reconcile).toHaveBeenCalledTimes(2);
		expect(fetchCredentials).not.toHaveBeenCalled();
		expect(createClient).not.toHaveBeenCalled();

		visibility = "hidden";
		instance.notifyVisibilityChange();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(reconcile).toHaveBeenCalledTimes(2);

		visibility = "visible";
		instance.notifyVisibilityChange();
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).toHaveBeenCalledTimes(3);

		instance.stop();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("cancels a pending follow-up timer when stopped mid-reconcile", async () => {
		const setTimeoutSpy = vi.fn((handler: () => void, timeout: number) =>
			setTimeout(handler, timeout),
		);
		const clearTimeoutSpy = vi.fn((handle: ReturnType<typeof setTimeout>) =>
			clearTimeout(handle),
		);
		const instance = manager(vi.fn<CredentialFetcher>(), {
			timers: { setTimeout: setTimeoutSpy, clearTimeout: clearTimeoutSpy },
		});
		const pending: Array<() => void> = [];
		const reconcile = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					pending.push(resolve);
				}),
		);
		instance.onReconcile(reconcile);
		instance.start();

		await vi.advanceTimersByTimeAsync(30_000);
		instance.notifyVisibilityChange();
		instance.stop();
		const timersAtStop = setTimeoutSpy.mock.calls.length;
		pending[0]();
		await vi.advanceTimersByTimeAsync(0);

		expect(setTimeoutSpy).toHaveBeenCalledTimes(timersAtStop);
		expect(vi.getTimerCount()).toBe(0);
		expect(reconcile).toHaveBeenCalledTimes(1);
	});

	it("closes the old socket and fetches a fresh lease before rejoining", async () => {
		const fetchCredentials = vi
			.fn<CredentialFetcher>()
			.mockResolvedValueOnce(
				credential(NOW + 300_000, {
					accessToken: "token-1",
					admittedProductIds: ["p1"],
				}),
			)
			.mockResolvedValueOnce(
				credential(NOW + 300_000, {
					accessToken: "token-2",
					admittedProductIds: ["p1"],
				}),
			);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.client.realtime.setAuth).toHaveBeenLastCalledWith("token-1");

		const onSubscribe = fake.channels[0].subscribe.mock.calls[0][0];
		onSubscribe("CHANNEL_ERROR");
		expect(fake.client.realtime.disconnect).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(999);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);

		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		expect(fake.client.realtime.setAuth).toHaveBeenLastCalledWith("token-2");
		await vi.advanceTimersByTimeAsync(500);
		expect(fake.channel).toHaveBeenCalledTimes(2);
		instance.stop();
	});

	it("resets the reconnect attempt after a successful join", async () => {
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
		);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);

		fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
		fake.channels[0].subscribe.mock.calls[0][0]("CHANNEL_ERROR");
		await vi.advanceTimersByTimeAsync(1_500);
		expect(fake.channel).toHaveBeenCalledTimes(2);

		fake.channels[1].subscribe.mock.calls[0][0]("SUBSCRIBED");
		fake.channels[1].subscribe.mock.calls[0][0]("CHANNEL_ERROR");
		await vi.advanceTimersByTimeAsync(1_500);
		expect(fake.channel).toHaveBeenCalledTimes(3);

		instance.stop();
	});

	it("keeps the 30-second REST cadence while credentials fail", async () => {
		const fetchCredentials = vi.fn<CredentialFetcher>(async () => {
			throw new Error("503");
		});
		const reconcileTimes: number[] = [];
		const instance = manager(fetchCredentials, {
			now: () => Date.now(),
		});
		instance.onReconcile(() => {
			reconcileTimes.push(Date.now());
		});
		const startedAt = Date.now();
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);

		expect(fake.channel).not.toHaveBeenCalled();
		expect(instance.getStatus()).toBe("degraded");

		await vi.advanceTimersByTimeAsync(30_000);
		expect(
			reconcileTimes.filter((time) => time === startedAt + 30_000),
		).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(30_000);
		expect(
			reconcileTimes.filter((time) => time === startedAt + 60_000),
		).toHaveLength(1);

		instance.stop();
	});

	it("keeps periodic REST reconciliation running after logout", async () => {
		const instance = manager(vi.fn<CredentialFetcher>());
		const reconcile = vi.fn();
		instance.onReconcile(reconcile);
		instance.start();
		instance.setAccount("customer-1");

		await vi.advanceTimersByTimeAsync(30_000);
		expect(reconcile).toHaveBeenCalledTimes(1);

		instance.setAccount(null);
		expect(instance.getStatus()).toBe("rest-only");

		await vi.advanceTimersByTimeAsync(30_000);
		expect(reconcile).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(30_000);
		expect(reconcile).toHaveBeenCalledTimes(3);

		instance.stop();
	});

	it("does not reconcile until the reconnect sync settles", async () => {
		const pending: Array<(value: RealtimeCredential) => void> = [];
		const fetchCredentials = vi
			.fn<CredentialFetcher>()
			.mockResolvedValueOnce(
				credential(NOW + 300_000, {
					accessToken: "token-1",
					admittedProductIds: ["p1"],
				}),
			)
			.mockImplementationOnce(
				() =>
					new Promise<RealtimeCredential>((resolve) => pending.push(resolve)),
			);
		const instance = manager(fetchCredentials);
		const reconcile = vi.fn();
		instance.onReconcile(reconcile);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).not.toHaveBeenCalled();

		const onSubscribe = fake.channels[0].subscribe.mock.calls[0][0];
		onSubscribe("CHANNEL_ERROR");
		await vi.advanceTimersByTimeAsync(1_000);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		expect(pending).toHaveLength(1);
		expect(reconcile).not.toHaveBeenCalled();

		pending[0](
			credential(NOW + 300_000, {
				accessToken: "token-2",
				admittedProductIds: ["p1"],
			}),
		);
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(500);
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).toHaveBeenCalledTimes(1);
		expect(fake.channel).toHaveBeenCalledTimes(2);

		instance.stop();
	});

	it("skips the reconnect reconcile while the tab is hidden", async () => {
		let visibility: DocumentVisibilityState = "visible";
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 300_000, {
				accessToken: "token-2",
				admittedProductIds: ["p1"],
			}),
		);
		const instance = manager(fetchCredentials, {
			visibility: () => visibility,
		});
		const reconcile = vi.fn();
		instance.onReconcile(reconcile);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.channel).toHaveBeenCalledTimes(1);

		visibility = "hidden";
		fake.channels[0].subscribe.mock.calls[0][0]("CHANNEL_ERROR");
		await vi.advanceTimersByTimeAsync(1_000);
		await vi.advanceTimersByTimeAsync(500);
		await vi.advanceTimersByTimeAsync(0);

		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		expect(fake.channel).toHaveBeenCalledTimes(2);
		expect(reconcile).not.toHaveBeenCalled();

		instance.stop();
	});

	it("stops renewal after the last stock listener leaves", async () => {
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
		);
		const instance = manager(fetchCredentials);
		instance.start();
		const unsubscribe = instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);

		unsubscribe();
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.removeChannel).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(270_000);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);
		instance.stop();
	});

	it("stops renewal when a refresh admits no stock topics", async () => {
		const fetchCredentials = vi
			.fn<CredentialFetcher>()
			.mockResolvedValueOnce(
				credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
			)
			.mockResolvedValueOnce(
				credential(NOW + 300_000, { admittedProductIds: [] }),
			);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);

		instance.subscribeStock("p2", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(270_000);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		instance.stop();
	});

	it("removes a revoked stock topic and falls back to REST on renewal", async () => {
		const fetchCredentials = vi
			.fn<CredentialFetcher>()
			.mockResolvedValueOnce(
				credential(NOW + 300_000, {
					accessToken: "token-1",
					admittedProductIds: ["p1", "p2"],
				}),
			)
			.mockResolvedValue(
				credential(NOW + 600_000, {
					accessToken: "token-2",
					admittedProductIds: ["p1"],
				}),
			);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		instance.subscribeStock("p2", () => {});
		await vi.advanceTimersByTimeAsync(1_000);
		for (const channel of fake.channels) {
			channel.subscribe.mock.calls[0][0]("SUBSCRIBED");
		}
		expect(instance.getStatus()).toBe("live");

		await vi.advanceTimersByTimeAsync(269_000);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(500);

		expect(fake.setAuth).toHaveBeenLastCalledWith("token-2");
		expect(fake.removed).toContain("stock:p2");
		expect(fake.channels.map(({ topic }) => topic)).toEqual([
			"stock:p1",
			"stock:p2",
		]);
		expect(instance.getStatus()).toBe("rest-only");

		instance.stop();
	});

	it("moves a renamed inbox to the new topic on renewal", async () => {
		const fetchCredentials = vi
			.fn<CredentialFetcher>()
			.mockResolvedValueOnce(
				credential(NOW + 300_000, {
					accessToken: "token-1",
					admittedProductIds: ["p1"],
					inboxTopic: "inbox:1",
				}),
			)
			.mockResolvedValue(
				credential(NOW + 600_000, {
					accessToken: "token-2",
					admittedProductIds: ["p1"],
					inboxTopic: "inbox:2",
				}),
			);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		instance.subscribeInbox(() => {});
		await vi.advanceTimersByTimeAsync(1_000);
		for (const channel of fake.channels) {
			channel.subscribe.mock.calls[0][0]("SUBSCRIBED");
		}
		expect(instance.getStatus()).toBe("live");

		await vi.advanceTimersByTimeAsync(269_000);
		await vi.advanceTimersByTimeAsync(500);

		expect(fake.removed).toContain("inbox:1");
		expect(fake.removed).not.toContain("stock:p1");
		const renamed = fake.channels.find(({ topic }) => topic === "inbox:2");
		expect(renamed).toBeDefined();
		expect(instance.getStatus()).toBe("connecting");
		renamed?.subscribe.mock.calls[0][0]("SUBSCRIBED");
		expect(instance.getStatus()).toBe("live");

		instance.stop();
	});

	it("joins a previously denied stock topic when a renewal grants it", async () => {
		const fetchCredentials = vi
			.fn<CredentialFetcher>()
			.mockResolvedValueOnce(
				credential(NOW + 300_000, {
					accessToken: "token-1",
					admittedProductIds: ["p1"],
				}),
			)
			.mockResolvedValue(
				credential(NOW + 600_000, {
					accessToken: "token-2",
					admittedProductIds: ["p1", "p2"],
				}),
			);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		instance.subscribeStock("p2", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.channels.map(({ topic }) => topic)).toEqual(["stock:p1"]);
		fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
		expect(instance.getStatus()).toBe("rest-only");

		await vi.advanceTimersByTimeAsync(270_000);
		await vi.advanceTimersByTimeAsync(500);

		expect(fake.channels.map(({ topic }) => topic)).toEqual([
			"stock:p1",
			"stock:p2",
		]);
		expect(instance.getStatus()).toBe("connecting");
		fake.channels[1].subscribe.mock.calls[0][0]("SUBSCRIBED");
		expect(instance.getStatus()).toBe("live");

		instance.stop();
	});

	it("drops channels, socket, and renewal when a renewal admits nothing", async () => {
		const fetchCredentials = vi
			.fn<CredentialFetcher>()
			.mockResolvedValueOnce(
				credential(NOW + 300_000, {
					accessToken: "token-1",
					admittedProductIds: ["p1"],
				}),
			)
			.mockResolvedValue(
				credential(NOW + 600_000, {
					accessToken: "token-2",
					admittedProductIds: [],
				}),
			);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
		expect(instance.getStatus()).toBe("live");

		await vi.advanceTimersByTimeAsync(270_000);

		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		expect(fake.removed).toContain("stock:p1");
		expect(fake.disconnect).toHaveBeenCalled();
		expect(instance.getStatus()).toBe("rest-only");

		await vi.advanceTimersByTimeAsync(270_000);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		instance.stop();
	});

	it("drops a renewal scope whose listener left while the renewal was pending", async () => {
		const pending: Array<(value: RealtimeCredential) => void> = [];
		const fetchCredentials = vi
			.fn<CredentialFetcher>()
			.mockResolvedValueOnce(
				credential(NOW + 300_000, {
					accessToken: "token-1",
					admittedProductIds: ["p1"],
				}),
			)
			.mockImplementationOnce(
				() =>
					new Promise<RealtimeCredential>((resolve) => pending.push(resolve)),
			);
		const instance = manager(fetchCredentials);
		instance.start();
		const unsubscribe = instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
		expect(instance.getStatus()).toBe("live");

		await vi.advanceTimersByTimeAsync(270_000);
		expect(pending).toHaveLength(1);
		unsubscribe();
		pending[0](
			credential(NOW + 600_000, {
				accessToken: "token-2",
				admittedProductIds: ["p1"],
			}),
		);
		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}
		await vi.advanceTimersByTimeAsync(500);
		await vi.advanceTimersByTimeAsync(0);

		expect(fake.channel).toHaveBeenCalledTimes(1);
		expect(fake.removed).toContain("stock:p1");
		expect(instance.getStatus()).toBe("rest-only");

		await vi.advanceTimersByTimeAsync(270_000);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		instance.stop();
	});

	it("cancels queued reconcile listeners and fences stale results on account switch", async () => {
		const instance = manager(vi.fn<CredentialFetcher>());
		const commits: string[] = [];
		const contexts: ReconcileContext[] = [];
		let release!: () => void;
		const first = vi.fn(async (context: ReconcileContext) => {
			contexts.push(context);
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			if (context.isCurrent()) {
				commits.push("first");
			}
		});
		const second = vi.fn(() => {
			commits.push("second");
		});
		instance.onReconcile(first);
		instance.onReconcile(second);
		instance.start();

		await vi.advanceTimersByTimeAsync(30_000);
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).not.toHaveBeenCalled();

		instance.setAccount("2");
		release();
		await vi.advanceTimersByTimeAsync(0);

		expect(contexts[0].signal.aborted).toBe(true);
		expect(contexts[0].isCurrent()).toBe(false);
		expect(commits).toEqual([]);
		expect(second).not.toHaveBeenCalled();
		instance.stop();
	});

	it("stays connecting until every current channel acknowledges", async () => {
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 300_000, { admittedProductIds: ["p1", "p2"] }),
		);
		const instance = manager(fetchCredentials);
		instance.start();
		instance.subscribeStock("p1", () => {});
		instance.subscribeStock("p2", () => {});
		await vi.advanceTimersByTimeAsync(1_000);
		expect(fake.channels.map(({ topic }) => topic)).toEqual([
			"stock:p1",
			"stock:p2",
		]);
		expect(instance.getStatus()).toBe("connecting");

		fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
		expect(instance.getStatus()).toBe("connecting");
		fake.channels[1].subscribe.mock.calls[0][0]("SUBSCRIBED");
		expect(instance.getStatus()).toBe("live");

		fake.channels[0].subscribe.mock.calls[0][0]("CLOSED");
		expect(instance.getStatus()).toBe("connecting");
		await vi.advanceTimersByTimeAsync(1_000);
		await vi.advanceTimersByTimeAsync(1_000);

		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		expect(fake.channels.map(({ topic }) => topic)).toEqual([
			"stock:p1",
			"stock:p2",
			"stock:p1",
			"stock:p2",
		]);
		fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
		expect(instance.getStatus()).toBe("connecting");
		fake.channels[2].subscribe.mock.calls[0][0]("SUBSCRIBED");
		fake.channels[3].subscribe.mock.calls[0][0]("SUBSCRIBED");
		expect(instance.getStatus()).toBe("live");

		instance.stop();
	});

	it("coalesces a signal into an already scheduled follow-up", async () => {
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
		);
		const instance = manager(fetchCredentials);
		const pending: Array<() => void> = [];
		const reconcile = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					pending.push(resolve);
				}),
		);
		instance.onReconcile(reconcile);
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);

		await vi.advanceTimersByTimeAsync(30_000);
		expect(pending).toHaveLength(1);
		instance.notifyVisibilityChange();
		pending[0]();
		for (let index = 0; index < 5; index += 1) {
			await Promise.resolve();
		}
		const timersBeforeSignal = vi.getTimerCount();

		const onBroadcast = fake.channels[0].on.mock.calls[0][2];
		onBroadcast({ payload: {} });
		expect(vi.getTimerCount()).toBe(timersBeforeSignal);

		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).toHaveBeenCalledTimes(2);
		expect(pending).toHaveLength(2);

		pending[1]();
		await vi.advanceTimersByTimeAsync(0);
		expect(reconcile).toHaveBeenCalledTimes(2);
		instance.stop();
	});

	it("clamps a renewal that would fire immediately", async () => {
		const setTimeoutSpy = vi.fn((handler: () => void, timeout: number) =>
			setTimeout(handler, timeout),
		);
		const clearTimeoutSpy = vi.fn((handle: ReturnType<typeof setTimeout>) =>
			clearTimeout(handle),
		);
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 10_000, { admittedProductIds: ["p1"] }),
		);
		const instance = manager(fetchCredentials, {
			timers: { setTimeout: setTimeoutSpy, clearTimeout: clearTimeoutSpy },
		});
		instance.start();
		instance.subscribeStock("p1", () => {});
		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}

		expect(fetchCredentials).toHaveBeenCalledTimes(1);
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1_000);
		instance.stop();
	});

	it("caps a far-future renewal delay at the maximum timer delay", async () => {
		const setTimeoutSpy = vi.fn((handler: () => void, timeout: number) =>
			setTimeout(handler, timeout),
		);
		const clearTimeoutSpy = vi.fn((handle: ReturnType<typeof setTimeout>) =>
			clearTimeout(handle),
		);
		const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
			credential(NOW + 10 * 365 * 24 * 60 * 60 * 1_000, {
				admittedProductIds: ["p1"],
			}),
		);
		const instance = manager(fetchCredentials, {
			timers: { setTimeout: setTimeoutSpy, clearTimeout: clearTimeoutSpy },
		});
		instance.start();
		instance.subscribeStock("p1", () => {});
		for (let index = 0; index < 10; index += 1) {
			await Promise.resolve();
		}

		expect(fetchCredentials).toHaveBeenCalledTimes(1);
		expect(setTimeoutSpy).toHaveBeenCalledWith(
			expect.any(Function),
			2_147_483_647,
		);
		instance.stop();
	});

	it.each([
		["unparsable", "not-a-date"],
		["already expired", new Date(NOW - 1).toISOString()],
	])(
		"treats an %s lease expiry as degraded and retries on backoff",
		async (_label, expiresAt) => {
			const setTimeoutSpy = vi.fn((handler: () => void, timeout: number) =>
				setTimeout(handler, timeout),
			);
			const clearTimeoutSpy = vi.fn((handle: ReturnType<typeof setTimeout>) =>
				clearTimeout(handle),
			);
			const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
				credential(NOW + 300_000, {
					expiresAt,
					admittedProductIds: ["p1"],
				}),
			);
			const instance = manager(fetchCredentials, {
				timers: { setTimeout: setTimeoutSpy, clearTimeout: clearTimeoutSpy },
			});
			instance.start();
			instance.subscribeStock("p1", () => {});
			await vi.advanceTimersByTimeAsync(0);

			expect(fetchCredentials).toHaveBeenCalledTimes(1);
			expect(fake.channel).not.toHaveBeenCalled();
			expect(instance.getStatus()).toBe("degraded");
			expect(
				setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 1_000),
			).toHaveLength(1);

			await vi.advanceTimersByTimeAsync(1_000);
			expect(fetchCredentials).toHaveBeenCalledTimes(2);
			await vi.advanceTimersByTimeAsync(1_000);
			expect(fetchCredentials).toHaveBeenCalledTimes(2);
			await vi.advanceTimersByTimeAsync(1_000);
			expect(fetchCredentials).toHaveBeenCalledTimes(3);

			instance.stop();
		},
	);

	it("keeps later reconcile listeners running when one rejects", async () => {
		const instance = manager(vi.fn<CredentialFetcher>());
		const failure = vi.fn(async () => {
			throw new Error("reconcile failed");
		});
		const later = vi.fn();
		instance.onReconcile(failure);
		instance.onReconcile(later);
		instance.start();

		await vi.advanceTimersByTimeAsync(30_000);
		expect(failure).toHaveBeenCalledTimes(1);
		expect(later).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(30_000);
		expect(failure).toHaveBeenCalledTimes(2);
		expect(later).toHaveBeenCalledTimes(2);

		instance.stop();
	});

	it("keeps the custom token through the real SDK heartbeat auth path", async () => {
		const instance = new RealtimeConnectionManager({
			env: () => ({
				url: "https://project.supabase.co",
				publishableKey: "pk-test",
			}),
			fetchCredentials: vi.fn<CredentialFetcher>(),
			now: () => NOW,
		});
		const internals = instance as unknown as {
			credential: RealtimeCredential | null;
			ensureClient: (env: {
				url: string;
				publishableKey: string;
			}) => SupabaseClient;
		};
		const client = internals.ensureClient({
			url: "https://project.supabase.co",
			publishableKey: "pk-test",
		});
		internals.credential = credential(NOW + 300_000, {
			accessToken: "custom-jwt",
		});

		await client.realtime.setAuth();

		expect(client.realtime.accessTokenValue).toBe("custom-jwt");

		internals.credential = null;
		await client.realtime.setAuth();

		expect(client.realtime.accessTokenValue).toBeNull();
	});

	describe("interest readiness lifecycle", () => {
		const stockP1: RealtimeInterest = { kind: "stock", productId: "p1" };

		function observe(
			instance: RealtimeConnectionManager,
			interest: RealtimeInterest = stockP1,
		) {
			const states: RealtimeInterestState[] = [];
			const contexts: ReconcileContext[] = [];
			const off = instance.onInterestState(interest, (state, context) => {
				states.push(state);
				contexts.push(context);
			});
			return { states, contexts, off };
		}

		it("cancels each superseded delivery independently and suppresses unchanged snapshots", async () => {
			const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
				credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
			);
			const instance = manager(fetchCredentials);
			instance.start();
			const first = observe(instance);
			const second = observe(instance);
			const initial = first.contexts.at(-1)!;
			const unsubscribe = instance.subscribeStock("p1", () => {});
			expect(initial.signal.aborted).toBe(true);
			expect(initial.isCurrent()).toBe(false);
			const pending = first.contexts.at(-1)!;
			expect(pending.signal.aborted).toBe(false);
			await vi.advanceTimersByTimeAsync(0);
			expect(pending.signal.aborted).toBe(true);
			expect(pending.isCurrent()).toBe(false);
			const admitted = first.contexts.at(-1)!;
			const ack = fake.channels[0].subscribe.mock.calls[0][0];
			ack("SUBSCRIBED");
			expect(admitted.signal.aborted).toBe(true);
			expect(admitted.isCurrent()).toBe(false);
			const live = first.contexts.at(-1)!;
			const otherLive = second.contexts.at(-1)!;
			const count = first.states.length;
			ack("SUBSCRIBED");
			expect(first.states).toHaveLength(count);
			expect(first.contexts.at(-1)).toBe(live);
			expect(live.isCurrent()).toBe(true);
			first.off();
			expect(live.signal.aborted).toBe(true);
			expect(live.isCurrent()).toBe(false);
			expect(otherLive.signal.aborted).toBe(false);
			expect(otherLive.isCurrent()).toBe(true);
			unsubscribe();
			expect(otherLive.signal.aborted).toBe(true);
			expect(otherLive.isCurrent()).toBe(false);
			expect(second.states.at(-1)?.status).toBe("disabled");
			instance.stop();
		});

		it("coalesces independent stock and inbox ACKs without waiting for denied stock", async () => {
			const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
				credential(NOW + 300_000, {
					admittedProductIds: ["p1", "p2"],
					inboxTopic: "inbox:test",
				}),
			);
			const instance = manager(fetchCredentials);
			instance.onInterestState(stockP1, () => {
				throw new Error("observer failed");
			});
			const stock = observe(instance);
			const secondStock = observe(instance, { kind: "stock", productId: "p2" });
			const denied = observe(instance, { kind: "stock", productId: "p3" });
			const inbox = observe(instance, { kind: "inbox" });
			const reconcile = vi.fn();
			instance.onReconcile(reconcile);
			instance.subscribeStock("p1", () => {});
			instance.subscribeStock("p2", () => {});
			instance.subscribeStock("p3", () => {});
			instance.subscribeInbox(() => {});
			instance.start();
			await vi.advanceTimersByTimeAsync(1_000);
			fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
			expect(stock.states.at(-1)?.status).toBe("live");
			expect(secondStock.states.at(-1)).toEqual({
				admission: "admitted", acknowledged: false, status: "connecting",
			});
			expect(inbox.states.at(-1)?.acknowledged).toBe(false);
			fake.channels[1].subscribe.mock.calls[0][0]("SUBSCRIBED");
			fake.channels[2].subscribe.mock.calls[0][0]("SUBSCRIBED");
			await vi.advanceTimersByTimeAsync(0);
			expect(reconcile).toHaveBeenCalledTimes(1);
			expect(inbox.states.at(-1)).toEqual({
				admission: "admitted", acknowledged: true, status: "live",
			});
			expect(instance.getStatus()).toBe("rest-only");
			const deniedDeliveries = denied.states.length;
			fake.channels[0].subscribe.mock.calls[0][0]("CHANNEL_ERROR");
			expect(stock.states.at(-1)?.admission).toBe("pending");
			expect(inbox.states.at(-1)?.admission).toBe("pending");
			expect(denied.states).toHaveLength(deniedDeliveries);
			expect(denied.states.at(-1)).toEqual({
				admission: "denied", acknowledged: false, status: "rest-only",
			});
			instance.stop();
		});

		it("marks the existing coalescer dirty on the first ACK only", async () => {
			const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
				credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
			);
			const instance = manager(fetchCredentials);
			const reconcile = vi.fn();
			instance.onReconcile(reconcile);
			instance.start();
			instance.subscribeStock("p1", () => {});
			await vi.advanceTimersByTimeAsync(0);
			expect(fake.channel).toHaveBeenCalledTimes(1);
			expect(reconcile).not.toHaveBeenCalled();

			const ack = fake.channels[0].subscribe.mock.calls[0][0];
			ack("SUBSCRIBED");
			await vi.advanceTimersByTimeAsync(0);
			expect(reconcile).toHaveBeenCalledTimes(1);

			ack("SUBSCRIBED");
			await vi.advanceTimersByTimeAsync(0);
			expect(reconcile).toHaveBeenCalledTimes(1);

			instance.stop();
		});

		it("retains an ACK while hidden and reconciles exactly once on focus", async () => {
			let visibility: DocumentVisibilityState = "visible";
			const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
				credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
			);
			const instance = manager(fetchCredentials, {
				visibility: () => visibility,
			});
			const reconcile = vi.fn();
			instance.onReconcile(reconcile);
			instance.start();
			instance.subscribeStock("p1", () => {});
			await vi.advanceTimersByTimeAsync(0);

			visibility = "hidden";
			instance.notifyVisibilityChange();
			fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
			await vi.advanceTimersByTimeAsync(0);
			expect(reconcile).not.toHaveBeenCalled();

			visibility = "visible";
			instance.notifyVisibilityChange();
			await vi.advanceTimersByTimeAsync(0);
			expect(reconcile).toHaveBeenCalledTimes(1);

			instance.stop();
		});

		it("schedules one dirty follow-up for an ACK during an in-flight reconcile", async () => {
			const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
				credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
			);
			const instance = manager(fetchCredentials);
			const pending: Array<() => void> = [];
			const reconcile = vi.fn(
				() =>
					new Promise<void>((resolve) => {
						pending.push(resolve);
					}),
			);
			instance.onReconcile(reconcile);
			instance.start();
			instance.subscribeStock("p1", () => {});
			await vi.advanceTimersByTimeAsync(0);

			await vi.advanceTimersByTimeAsync(30_000);
			expect(reconcile).toHaveBeenCalledTimes(1);

			const ack = fake.channels[0].subscribe.mock.calls[0][0];
			ack("SUBSCRIBED");
			ack("SUBSCRIBED");
			await vi.advanceTimersByTimeAsync(0);
			expect(reconcile).toHaveBeenCalledTimes(1);

			pending[0]();
			await vi.advanceTimersByTimeAsync(0);
			expect(reconcile).toHaveBeenCalledTimes(2);
			expect(pending).toHaveLength(2);

			pending[1]();
			await vi.advanceTimersByTimeAsync(0);
			expect(reconcile).toHaveBeenCalledTimes(2);

			instance.stop();
		});

		it("returns an admitted interest to pending on readiness loss and live on the next ACK", async () => {
			const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
				credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
			);
			const instance = manager(fetchCredentials);
			const { states } = observe(instance);
			instance.start();
			instance.subscribeStock("p1", () => {});
			await vi.advanceTimersByTimeAsync(0);
			fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
			expect(states.at(-1)?.status).toBe("live");

			fake.channels[0].subscribe.mock.calls[0][0]("CHANNEL_ERROR");
			expect(instance.getStatus()).toBe("connecting");
			expect(states.at(-1)).toEqual({
				admission: "pending",
				acknowledged: false,
				status: "connecting",
			});

			await vi.advanceTimersByTimeAsync(1_000);
			await vi.advanceTimersByTimeAsync(500);
			await vi.advanceTimersByTimeAsync(0);
			expect(fake.channel).toHaveBeenCalledTimes(2);
			expect(states.at(-1)).toEqual({
				admission: "admitted",
				acknowledged: false,
				status: "connecting",
			});

			fake.channels[1].subscribe.mock.calls[0][0]("SUBSCRIBED");
			expect(states.at(-1)).toEqual({
				admission: "admitted",
				acknowledged: true,
				status: "live",
			});

			instance.stop();
		});

		it("returns an admitted interest to pending while a renewal is unresolved", async () => {
			const pending: Array<(value: RealtimeCredential) => void> = [];
			const fetchCredentials = vi
				.fn<CredentialFetcher>()
				.mockResolvedValueOnce(
					credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
				)
				.mockImplementationOnce(
					() =>
						new Promise<RealtimeCredential>((resolve) =>
							pending.push(resolve),
						),
				);
			const instance = manager(fetchCredentials);
			const { states } = observe(instance);
			instance.start();
			instance.subscribeStock("p1", () => {});
			await vi.advanceTimersByTimeAsync(0);
			fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
			expect(states.at(-1)?.status).toBe("live");

			await vi.advanceTimersByTimeAsync(270_000);
			expect(pending).toHaveLength(1);
			expect(states.at(-1)).toEqual({
				admission: "pending",
				acknowledged: false,
				status: "connecting",
			});

			pending[0](
				credential(NOW + 600_000, { admittedProductIds: ["p1"] }),
			);
			await vi.advanceTimersByTimeAsync(0);
			expect(states.at(-1)).toEqual({
				admission: "admitted",
				acknowledged: true,
				status: "live",
			});

			instance.stop();
		});

		it("publishes the synchronous account reset, stop, and restart snapshots", async () => {
			const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
				credential(NOW + 300_000, {
					accessToken: "token-1",
					admittedProductIds: ["p1"],
				}),
			);
			const instance = manager(fetchCredentials);
			const deliveries: Array<{
				state: RealtimeInterestState;
				context: ReconcileContext;
			}> = [];
			instance.onInterestState(stockP1, (state, context) => {
				deliveries.push({ state, context });
			});
			instance.start();
			instance.subscribeStock("p1", () => {});
			await vi.advanceTimersByTimeAsync(0);
			const oldAck = fake.channels[0].subscribe.mock.calls[0][0];
			oldAck("SUBSCRIBED");
			const live = deliveries.at(-1)!;
			expect(live.state).toEqual({
				admission: "admitted",
				acknowledged: true,
				status: "live",
			});
			expect(live.context.isCurrent()).toBe(true);

			instance.setAccount("customer-2");
			expect(live.context.signal.aborted).toBe(true);
			expect(live.context.isCurrent()).toBe(false);
			expect(deliveries.at(-1)?.state).toEqual({
				admission: "pending",
				acknowledged: false,
				status: "connecting",
			});

			oldAck("SUBSCRIBED");
			expect(deliveries.at(-1)?.state.acknowledged).toBe(false);

			await vi.advanceTimersByTimeAsync(0);
			const admittedAfterSwitch = deliveries.at(-1)!;
			expect(admittedAfterSwitch.state).toEqual({
				admission: "admitted",
				acknowledged: false,
				status: "connecting",
			});

			instance.stop();
			expect(admittedAfterSwitch.context.signal.aborted).toBe(true);
			expect(admittedAfterSwitch.context.isCurrent()).toBe(false);
			const stopped = deliveries.at(-1)!;
			expect(stopped.state).toEqual({
				admission: "unavailable",
				acknowledged: false,
				status: "disabled",
			});
			expect(stopped.context.isCurrent()).toBe(false);

			instance.start();
			const restarted = deliveries.at(-1)!;
			expect(restarted.state).toEqual({
				admission: "unavailable",
				acknowledged: false,
				status: "disabled",
			});
			expect(restarted.context).not.toBe(stopped.context);
			expect(restarted.context.isCurrent()).toBe(true);

			instance.stop();
		});

		it("keeps the signal reference when an observer alone unsubscribes", async () => {
			const fetchCredentials = vi.fn<CredentialFetcher>(async () =>
				credential(NOW + 300_000, { admittedProductIds: ["p1"] }),
			);
			const instance = manager(fetchCredentials);
			instance.start();
			const unsubscribe = instance.subscribeStock("p1", () => {});
			await vi.advanceTimersByTimeAsync(0);
			fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
			const first = observe(instance);
			const second = observe(instance);
			expect(first.states.at(-1)?.status).toBe("live");
			expect(second.states.at(-1)?.status).toBe("live");

			first.off();
			expect(fake.removeChannel).not.toHaveBeenCalled();
			expect(second.states.at(-1)?.status).toBe("live");
			expect(instance.getInterestState(stockP1).status).toBe("live");

			unsubscribe();
			expect(second.states.at(-1)).toEqual({
				admission: "unavailable",
				acknowledged: false,
				status: "disabled",
			});
			expect(fake.removeChannel).toHaveBeenCalledTimes(1);

			second.off();
			instance.stop();
		});
	});
});
