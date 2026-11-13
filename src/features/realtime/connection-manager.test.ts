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
import {
	RealtimeConnectionManager,
	type RealtimeManagerDeps,
} from "./connection-manager";
import { JoinScheduler } from "./join-scheduler";
import type { RealtimeCredential } from "./schema";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

type CredentialFetcher = (productIds: string[]) => Promise<RealtimeCredential>;

type FakeChannel = {
	topic: string;
	options: unknown;
	at: number;
	on: ReturnType<typeof vi.fn>;
	subscribe: ReturnType<typeof vi.fn>;
	unsubscribe: ReturnType<typeof vi.fn>;
};

const ENV = { url: "https://project.supabase.co", publishableKey: "pk" };
const EXPIRES = new Date(Date.now() + 300_000).toISOString();

function credential(
	overrides: Partial<RealtimeCredential> = {},
): RealtimeCredential {
	return {
		accessToken: "token-1",
		expiresAt: EXPIRES,
		admittedProductIds: [],
		inboxTopic: null,
		...overrides,
	};
}

function createFakeClient() {
	const calls: string[] = [];
	const channels: FakeChannel[] = [];
	const channel = vi.fn((topic: string, options: unknown) => {
		calls.push(`channel:${topic}`);
		const created: FakeChannel = {
			topic,
			options,
			at: Date.now(),
			on: vi.fn(),
			subscribe: vi.fn(),
			unsubscribe: vi.fn(),
		};
		channels.push(created);
		return created;
	});
	const removeChannel = vi.fn(async (created: FakeChannel) => {
		calls.push(`remove:${created.topic}`);
	});
	const client = {
		realtime: {
			setAuth: vi.fn((token: string) => {
				calls.push(`auth:${token}`);
			}),
			disconnect: vi.fn(),
		},
		channel,
		removeChannel,
	};

	return {
		client: client as unknown as SupabaseClient,
		calls,
		channels,
		channel,
		removeChannel,
	};
}

describe("RealtimeConnectionManager core", () => {
	let fake: ReturnType<typeof createFakeClient>;
	let fetchCredentials: Mock<CredentialFetcher>;

	beforeEach(() => {
		fake = createFakeClient();
		fetchCredentials = vi.fn<CredentialFetcher>(async (ids) =>
			credential({ admittedProductIds: ids }),
		);
		createClientMock.mockReset();
		createClientMock.mockReturnValue(fake.client);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function manager(overrides: Partial<RealtimeManagerDeps> = {}) {
		return new RealtimeConnectionManager({
			env: () => ENV,
			fetchCredentials,
			createClient: () => fake.client,
			...overrides,
		});
	}

	function fastScheduler() {
		return new JoinScheduler(() => 0, 0);
	}

	it("opens no client or channel without an admitted listener", async () => {
		const instance = manager();
		instance.start();

		expect(fetchCredentials).not.toHaveBeenCalled();
		expect(fake.channel).not.toHaveBeenCalled();
		expect(instance.getStatus()).toBe("rest-only");
		instance.stop();
	});

	it("reports degraded when realtime configuration is absent", () => {
		const instance = manager({ env: () => null });
		instance.start();
		instance.subscribeStock("p1", () => {});

		expect(fetchCredentials).not.toHaveBeenCalled();
		expect(fake.channel).not.toHaveBeenCalled();
		expect(instance.getStatus()).toBe("degraded");

		instance.stop();
		expect(instance.getStatus()).toBe("degraded");
	});

	it("creates one client per tab even when start runs twice", async () => {
		const instance = new RealtimeConnectionManager({
			env: () => ENV,
			fetchCredentials,
			joinScheduler: fastScheduler(),
		});
		instance.start();
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.waitFor(() => expect(fake.channel).toHaveBeenCalled());

		expect(createClientMock).toHaveBeenCalledTimes(1);
		expect(fake.channel).toHaveBeenCalledTimes(1);
		instance.stop();
	});

	it("requests at most 24 stock topics", async () => {
		const instance = manager({ joinScheduler: fastScheduler() });
		instance.start();
		for (let index = 0; index < 25; index += 1) {
			instance.subscribeStock(`p${index}`, () => {});
		}
		await vi.waitFor(() =>
			expect(fake.channel).toHaveBeenCalledTimes(24),
		);

		expect(fetchCredentials.mock.calls.at(-1)?.[0]).toHaveLength(24);
		expect(fake.channel).toHaveBeenCalledTimes(24);
		expect(
			fake.channel.mock.calls.map(([topic]) => topic),
		).not.toContain("stock:p24");
		for (const channel of fake.channels) {
			channel.subscribe.mock.calls[0][0]("SUBSCRIBED");
		}
		expect(instance.getStatus()).toBe("rest-only");
		instance.stop();
	});

	it("caps an over-admitting credential at 24 stock channels", async () => {
		fetchCredentials.mockResolvedValue(
			credential({
				admittedProductIds: Array.from(
					{ length: 25 },
					(_, index) => `p${index}`,
				),
			}),
		);
		const instance = manager({ joinScheduler: fastScheduler() });
		instance.start();
		for (let index = 0; index < 25; index += 1) {
			instance.subscribeStock(`p${index}`, () => {});
		}
		await vi.waitFor(() =>
			expect(fake.channel).toHaveBeenCalledTimes(24),
		);

		const topics = fake.channel.mock.calls.map(([topic]) => topic);
		expect(topics).toHaveLength(24);
		expect(topics).not.toContain("stock:p24");
		instance.stop();
	});

	it("reports rest-only when admitted identities differ from the request", async () => {
		fetchCredentials.mockResolvedValue(
			credential({
				admittedProductIds: Array.from(
					{ length: 24 },
					(_, index) => `p${index + 1}`,
				),
			}),
		);
		const instance = manager({ joinScheduler: fastScheduler() });
		instance.start();
		for (let index = 0; index < 25; index += 1) {
			instance.subscribeStock(`p${index}`, () => {});
		}
		await vi.waitFor(() => {
			expect(fake.channel).toHaveBeenCalledTimes(23);
			expect(instance.getStatus()).toBe("rest-only");
		});

		expect(instance.getStatus()).toBe("rest-only");
		expect(
			fake.channel.mock.calls.map(([topic]) => topic),
		).not.toContain("stock:p0");
		instance.stop();
	});

	it("joins an inbox topic only when the lease grants one", async () => {
		fetchCredentials.mockResolvedValue(credential({ inboxTopic: null }));
		const instance = manager();
		instance.start();
		instance.subscribeInbox(() => {});
		await vi.waitFor(() => expect(fetchCredentials).toHaveBeenCalled());

		expect(fake.channel).not.toHaveBeenCalled();
		expect(instance.getStatus()).toBe("rest-only");
		instance.stop();
	});

	it("joins a granted inbox topic", async () => {
		fetchCredentials.mockResolvedValue(
			credential({ inboxTopic: "inbox:user-1" }),
		);
		const instance = manager({ joinScheduler: fastScheduler() });
		instance.start();
		instance.subscribeInbox(() => {});
		await vi.waitFor(() => expect(fake.channel).toHaveBeenCalledTimes(1));

		expect(fake.channel.mock.calls[0][0]).toBe("inbox:user-1");
		fake.channels[0].subscribe.mock.calls[0][0]("SUBSCRIBED");
		expect(instance.getStatus()).toBe("live");
		instance.stop();
	});

	it("admits only stock scopes for a guest lease", async () => {
		fetchCredentials.mockResolvedValue(
			credential({ admittedProductIds: ["p1"], inboxTopic: null }),
		);
		const instance = manager({ joinScheduler: fastScheduler() });
		instance.start();
		instance.subscribeStock("p1", () => {});
		instance.subscribeInbox(() => {});
		await vi.waitFor(() => expect(fake.channel).toHaveBeenCalledTimes(1));

		expect(fake.channel.mock.calls.map(([topic]) => topic)).toEqual([
			"stock:p1",
		]);
		expect(instance.getStatus()).toBe("rest-only");
		instance.stop();
	});

	it("admits stock and inbox scopes for an authenticated lease", async () => {
		fetchCredentials.mockResolvedValue(
			credential({
				admittedProductIds: ["p1"],
				inboxTopic: "inbox:user-1",
			}),
		);
		const instance = manager({ joinScheduler: fastScheduler() });
		instance.start();
		instance.subscribeStock("p1", () => {});
		instance.subscribeInbox(() => {});
		await vi.waitFor(() => expect(fake.channel).toHaveBeenCalledTimes(2));

		expect(fake.channel.mock.calls.map(([topic]) => topic)).toEqual([
			"stock:p1",
			"inbox:user-1",
		]);
		for (const channel of fake.channels) {
			channel.subscribe.mock.calls[0][0]("SUBSCRIBED");
		}
		expect(instance.getStatus()).toBe("live");
		instance.stop();
	});

	it("does not retry a denied stock topic in a tight loop", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		fetchCredentials.mockResolvedValue(
			credential({ admittedProductIds: [], inboxTopic: null }),
		);
		const instance = manager();
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);

		expect(fetchCredentials).toHaveBeenCalledTimes(1);
		expect(fake.channel).not.toHaveBeenCalled();
		expect(instance.getStatus()).toBe("rest-only");

		await vi.advanceTimersByTimeAsync(60_000);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);
		expect(fake.channel).not.toHaveBeenCalled();
		instance.stop();
	});

	it("drops a failed attempt's queued joins and shares one budget after backoff", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		fetchCredentials.mockImplementation(async () =>
			credential({
				expiresAt: new Date(Date.now() + 300_000).toISOString(),
				admittedProductIds: ["p1", "p2", "p3"],
			}),
		);
		const instance = manager({ random: () => 0 });
		instance.start();
		for (const productId of ["p1", "p2", "p3"]) {
			instance.subscribeStock(productId, () => {});
		}
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.channel).toHaveBeenCalledTimes(1);

		fake.channels[0].subscribe.mock.calls[0][0]("CHANNEL_ERROR");
		await vi.advanceTimersByTimeAsync(999);
		expect(fake.channel.mock.calls.map(([topic]) => topic)).toEqual([
			"stock:p1",
		]);
		expect(fetchCredentials).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1_001);
		const topics = fake.channel.mock.calls.map(([topic]) => topic);
		expect(topics).toEqual([
			"stock:p1",
			"stock:p1",
			"stock:p2",
			"stock:p3",
		]);
		const grantedAt = fake.channels.map((channel) => channel.at);
		expect(grantedAt).toEqual([0, 1_000, 1_500, 2_000]);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		instance.stop();
	});

	it("escalates backoff after repeated channel failures", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		fetchCredentials.mockResolvedValue(
			credential({
				expiresAt: new Date(Date.now() + 300_000).toISOString(),
				admittedProductIds: ["p1"],
			}),
		);
		const instance = manager({ random: () => 0 });
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.channel).toHaveBeenCalledTimes(1);

		fake.channels[0].subscribe.mock.calls[0][0]("CHANNEL_ERROR");
		await vi.advanceTimersByTimeAsync(1_000);
		expect(fake.channel).toHaveBeenCalledTimes(2);

		fake.channels[1].subscribe.mock.calls[0][0]("CHANNEL_ERROR");
		await vi.advanceTimersByTimeAsync(1_000);
		expect(fake.channel).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(fake.channel).toHaveBeenCalledTimes(3);
		instance.stop();
	});

	it("sets the fresh access token before joining", async () => {
		const instance = manager();
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.waitFor(() => expect(fake.channel).toHaveBeenCalled());

		expect(fake.calls).toEqual(["auth:token-1", "channel:stock:p1"]);
		expect(fake.channel.mock.calls[0][1]).toEqual({
			config: { private: true, broadcast: { self: false } },
		});
		instance.stop();
	});

	it("disables persisted Supabase auth in the real client", async () => {
		const instance = new RealtimeConnectionManager({
			env: () => ENV,
			fetchCredentials,
		});
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.waitFor(() => expect(createClientMock).toHaveBeenCalled());

		expect(createClientMock).toHaveBeenCalledWith(ENV.url, ENV.publishableKey, {
			auth: {
				persistSession: false,
				autoRefreshToken: false,
				detectSessionInUrl: false,
			},
			realtime: {
				accessToken: expect.any(Function),
				reconnectAfterMs: expect.any(Function),
			},
		});
		instance.stop();
	});

	it("removes a channel only when its last listener unsubscribes", async () => {
		const instance = manager();
		instance.start();
		const offFirst = instance.subscribeStock("p1", () => {});
		const offSecond = instance.subscribeStock("p1", () => {});
		await vi.waitFor(() => expect(fake.channel).toHaveBeenCalled());

		offFirst();
		expect(fake.removeChannel).not.toHaveBeenCalled();
		offSecond();
		expect(fake.removeChannel).toHaveBeenCalledTimes(1);
		instance.stop();
	});

	it("does not join a topic whose last listener leaves while waiting", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		fetchCredentials.mockResolvedValue(
			credential({
				expiresAt: new Date(Date.now() + 300_000).toISOString(),
				admittedProductIds: ["p1", "p2"],
			}),
		);
		const instance = manager();
		instance.start();
		instance.subscribeStock("p1", () => {});
		const offSecond = instance.subscribeStock("p2", () => {});
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.channel).toHaveBeenCalledTimes(1);

		offSecond();
		await vi.advanceTimersByTimeAsync(1_000);

		const topics = fake.channel.mock.calls.map(([topic]) => topic);
		expect(topics).toEqual(["stock:p1"]);
		instance.stop();
	});

	it("promotes a queued stock topic when a cap slot frees", async () => {
		const instance = manager({ joinScheduler: fastScheduler() });
		instance.start();
		const unsubscribe: Array<() => void> = [];
		for (let index = 0; index < 25; index += 1) {
			unsubscribe.push(instance.subscribeStock(`p${index}`, () => {}));
		}
		await vi.waitFor(() =>
			expect(fake.channel).toHaveBeenCalledTimes(24),
		);
		expect(
			fake.channel.mock.calls.map(([topic]) => topic),
		).not.toContain("stock:p24");

		unsubscribe[0]();
		await vi.waitFor(() =>
			expect(fake.channel.mock.calls.map(([topic]) => topic)).toContain(
				"stock:p24",
			),
		);
		instance.stop();
	});

	it("discards a credential fetched for an older account generation", async () => {
		const pending: Array<(value: RealtimeCredential) => void> = [];
		fetchCredentials.mockImplementation(
			() => new Promise<RealtimeCredential>((resolve) => pending.push(resolve)),
		);
		const instance = manager();
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.waitFor(() => expect(pending).toHaveLength(1));

		instance.setAccount("2");
		pending[0](credential({ admittedProductIds: ["p1"] }));
		await vi.waitFor(() => expect(pending).toHaveLength(2));
		expect(fake.channel).not.toHaveBeenCalled();

		pending[1](credential({ admittedProductIds: ["p1"] }));
		await vi.waitFor(() => expect(fake.channel).toHaveBeenCalledTimes(1));
		instance.stop();
	});

	it("drops a stale join queue promptly after an account switch", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		fetchCredentials.mockResolvedValue(
			credential({
				expiresAt: new Date(Date.now() + 300_000).toISOString(),
				admittedProductIds: Array.from(
					{ length: 10 },
					(_, index) => `p${index}`,
				),
			}),
		);
		const instance = manager();
		instance.start();
		for (let index = 0; index < 10; index += 1) {
			instance.subscribeStock(`p${index}`, () => {});
		}
		await vi.advanceTimersByTimeAsync(0);
		expect(fake.channel).toHaveBeenCalledTimes(1);

		instance.setAccount("2");
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchCredentials).toHaveBeenCalledTimes(2);
		expect(fake.channel.mock.calls.map(([topic]) => topic)).toEqual([
			"stock:p0",
		]);

		await vi.advanceTimersByTimeAsync(1_000);
		expect(fake.channel.mock.calls.map(([topic]) => topic)).toEqual([
			"stock:p0",
			"stock:p0",
			"stock:p1",
		]);
		instance.stop();
	});

	it("stop clears channels and private listeners", async () => {
		const instance = manager();
		instance.start();
		instance.subscribeStock("p1", () => {});
		await vi.waitFor(() => expect(fake.channel).toHaveBeenCalled());

		instance.stop();

		expect(fake.removeChannel).toHaveBeenCalled();
		expect(instance.getStatus()).toBe("rest-only");
	});
});
