"use client";

import {
	createClient,
	type RealtimeChannel,
	type SupabaseClient,
} from "@supabase/supabase-js";
import { getRealtimePublicEnv } from "@/lib/env";
import { fetchRealtimeCredentials } from "./api/realtime.api";
import { reconnectDelay } from "./backoff";
import { JoinScheduler } from "./join-scheduler";
import type { RealtimeCredential } from "./schema";
import {
	INBOX_EVENT,
	STOCK_EVENT,
	type RealtimeListener,
	type RealtimeSignal,
	type RealtimeStatus,
	type ReconcileContext,
	type ReconcileListener,
} from "./types";

type PublicEnv = { url: string; publishableKey: string };

type Timers = {
	setTimeout: (
		handler: () => void,
		timeout: number,
	) => ReturnType<typeof setTimeout>;
	clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
};

type TransportConnection = {
	readyState: number;
	addEventListener?: (
		type: string,
		listener: () => void,
		options?: AddEventListenerOptions,
	) => void;
	removeEventListener?: (type: string, listener: () => void) => void;
};

type TransportSocket = {
	reconnectAfterMs?: (tries: number) => number;
	conn?: TransportConnection | null;
};

type TransportAdapter = {
	getSocket?: () => TransportSocket | null;
	onOpen?: (callback: () => void) => void;
	onClose?: (callback: () => void) => void;
};

type RealtimeTransport = {
	connect?: () => void;
	disconnect?: () => Promise<unknown> | unknown;
	isConnected?: () => boolean;
	setAuth: (token?: string) => Promise<void> | void;
	reconnectTimer?: { reset?: () => void };
	socketAdapter?: TransportAdapter;
};

type OpenWaiter = {
	resolve: (opened: boolean) => void;
	timer: ReturnType<typeof setTimeout> | null;
};

export type RealtimeManagerDeps = {
	createClient?: (url: string, key: string) => SupabaseClient;
	fetchCredentials?: (productIds: string[]) => Promise<RealtimeCredential>;
	env?: () => PublicEnv | null;
	visibility?: () => DocumentVisibilityState;
	random?: () => number;
	now?: () => number;
	timers?: Timers;
	joinScheduler?: JoinScheduler;
};

const RECONCILE_INTERVAL_MS = 30_000;
const RECONCILE_JITTER_MS = 10_000;
const RENEW_LEAD_MS = 30_000;
const MIN_RENEW_DELAY_MS = 1_000;
const MAX_RENEW_DELAY_MS = 2_147_483_647;
const MAX_STOCK_TOPICS = 24;
const TRANSPORT_OPEN_TIMEOUT_MS = 10_000;
const SDK_RECONNECT_SUPPRESSION_MS = 2_147_483_647;

export class RealtimeConnectionManager {
	private readonly createClientImpl: (url: string, key: string) => SupabaseClient;
	private readonly fetchCredentials: (
		productIds: string[],
	) => Promise<RealtimeCredential>;
	private readonly env: () => PublicEnv | null;
	private readonly visibility: () => DocumentVisibilityState;
	private readonly random: () => number;
	private readonly now: () => number;
	private readonly timers: Timers;
	private readonly joinScheduler: JoinScheduler;

	private started = false;
	private status: RealtimeStatus = "disabled";
	private client: SupabaseClient | null = null;
	private credential: RealtimeCredential | null = null;
	private channels = new Map<string, RealtimeChannel>();
	private acknowledged = new Map<string, RealtimeChannel>();
	private expectedTopics = new Set<string>();
	private denied = false;
	private readonly stockRefs = new Map<string, Set<RealtimeListener>>();
	private readonly inboxRefs = new Set<RealtimeListener>();
	private readonly reconcileListeners = new Set<ReconcileListener>();
	private generation = 0;
	private attempt = 0;
	private account: string | null = null;
	private reconnectAttempt = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private renewTimer: ReturnType<typeof setTimeout> | null = null;
	private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
	private signalTimer: ReturnType<typeof setTimeout> | null = null;
	private followUpTimer: ReturnType<typeof setTimeout> | null = null;
	private reconcileRun = 0;
	private reconcileController: AbortController | null = null;
	private reconcileInFlight = false;
	private dirty = false;
	private followUp = false;
	private syncInFlight: { attempt: number; promise: Promise<void> } | null = null;
	private syncRequested = false;
	private visibilityListening = false;
	private transportAllowed = false;
	private transportGuarded = false;
	private readonly openWaiters = new Set<OpenWaiter>();
	private teardown: Promise<void> = Promise.resolve();

	private readonly handleVisibilityChange = (): void => {
		this.notifyVisibilityChange();
	};

	constructor(deps: RealtimeManagerDeps = {}) {
		this.createClientImpl =
			deps.createClient ??
			((url, key) =>
				createClient(url, key, {
					auth: {
						persistSession: false,
						autoRefreshToken: false,
						detectSessionInUrl: false,
					},
					realtime: {
						accessToken: async () => this.credential?.accessToken ?? null,
						reconnectAfterMs: () => SDK_RECONNECT_SUPPRESSION_MS,
					},
				}));
		this.fetchCredentials = deps.fetchCredentials ?? fetchRealtimeCredentials;
		this.env =
			deps.env ??
			(() => {
				try {
					return getRealtimePublicEnv();
				} catch {
					return null;
				}
			});
		this.visibility =
			deps.visibility ??
			(() =>
				typeof document === "undefined" ? "visible" : document.visibilityState);
		this.random = deps.random ?? Math.random;
		this.now = deps.now ?? Date.now;
		this.timers = deps.timers ?? { setTimeout, clearTimeout };
		this.joinScheduler = deps.joinScheduler ?? new JoinScheduler(this.now);
	}

	start(): void {
		if (this.started) {
			return;
		}
		this.started = true;
		this.addVisibilityListener();
		this.scheduleReconcile();
		if (!this.env()) {
			this.status = "degraded";
			return;
		}
		this.status = "rest-only";
		void this.sync();
	}

	stop(): void {
		this.started = false;
		this.generation += 1;
		this.attempt += 1;
		this.invalidateReconcile();
		this.clearTimers();
		this.removeVisibilityListener();
		this.credential = null;
		this.expectedTopics.clear();
		this.acknowledged.clear();
		this.denied = false;
		this.teardown = this.teardownTransport();
		this.stockRefs.clear();
		this.inboxRefs.clear();
		this.reconcileListeners.clear();
		this.reconnectAttempt = 0;
		this.dirty = false;
		this.followUp = false;
		this.reconcileInFlight = false;
		this.syncRequested = false;
		this.status = this.env() ? "rest-only" : "degraded";
	}

	getStatus(): RealtimeStatus {
		return this.status;
	}

	subscribeStock(productId: string, listener: RealtimeListener): () => void {
		let listeners = this.stockRefs.get(productId);
		if (!listeners) {
			listeners = new Set();
			this.stockRefs.set(productId, listeners);
		}
		listeners.add(listener);
		void this.sync();

		return () => {
			const current = this.stockRefs.get(productId);
			if (!current) {
				return;
			}
			current.delete(listener);
			if (current.size === 0) {
				this.stockRefs.delete(productId);
				void this.removeChannel(`stock:${productId}`);
				void this.sync();
			}
		};
	}

	subscribeInbox(listener: RealtimeListener): () => void {
		this.inboxRefs.add(listener);
		void this.sync();

		return () => {
			this.inboxRefs.delete(listener);
			if (this.inboxRefs.size === 0) {
				void this.removeChannel(this.credential?.inboxTopic ?? "");
				void this.sync();
			}
		};
	}

	onReconcile(listener: ReconcileListener): () => void {
		this.reconcileListeners.add(listener);
		return () => {
			this.reconcileListeners.delete(listener);
		};
	}

	setAccount(accountId: string | number | null): void {
		const next = accountId === null ? null : String(accountId);
		if (this.account === next) {
			return;
		}
		this.account = next;
		if (!this.started) {
			return;
		}
		this.generation += 1;
		this.attempt += 1;
		this.invalidateReconcile();
		this.clearTimers();
		this.dirty = false;
		this.followUp = false;
		this.reconcileInFlight = false;
		this.syncRequested = false;
		this.credential = null;
		this.expectedTopics.clear();
		this.acknowledged.clear();
		this.denied = false;
		this.teardown = this.teardownTransport();
		this.reconnectAttempt = 0;

		const env = this.env();
		if (!env) {
			this.status = "degraded";
			this.scheduleReconcile();
			return;
		}
		this.status = "rest-only";
		this.scheduleReconcile();
		if (next !== null && (this.stockRefs.size > 0 || this.inboxRefs.size > 0)) {
			void this.sync();
		}
	}

	notifyVisibilityChange(): void {
		if (!this.started) {
			return;
		}
		if (this.visibility() === "hidden") {
			this.clearReconcileTimer();
			return;
		}
		this.scheduleReconcile(true);
		void this.runReconcile();
	}

	private sync(): Promise<void> {
		if (!this.started) {
			return Promise.resolve();
		}
		if (this.syncInFlight && this.syncInFlight.attempt === this.attempt) {
			this.syncRequested = true;
			return this.syncInFlight.promise;
		}
		// A new attempt must not wait behind a stale attempt's queued joins.
		this.syncRequested = false;
		const generation = this.generation;
		const attempt = this.attempt;
		const promise = this.doSync(generation, attempt).finally(() => {
			if (this.syncInFlight?.promise !== promise) {
				return;
			}
			this.syncInFlight = null;
			if (this.syncRequested) {
				this.syncRequested = false;
				void this.sync();
			}
		});
		this.syncInFlight = { attempt, promise };
		return promise;
	}

	private async doSync(generation: number, attempt: number): Promise<void> {
		const env = this.env();
		if (!env) {
			this.status = "degraded";
			return;
		}
		const teardown = this.teardown;
		const requestedAll = [...this.stockRefs.keys()];
		const requested = requestedAll.slice(0, MAX_STOCK_TOPICS);
		const wantsInbox = this.inboxRefs.size > 0;
		await teardown;
		if (!this.isCurrent(generation, attempt)) {
			return;
		}

		if (requested.length === 0 && !wantsInbox) {
			this.clearRenewalTimer();
			this.expectedTopics.clear();
			this.acknowledged.clear();
			this.denied = false;
			await this.disconnectIfIdle();
			if (!this.isCurrent(generation, attempt)) {
				return;
			}
			this.status = "rest-only";
			return;
		}

		this.status = "connecting";
		let credential: RealtimeCredential;
		try {
			credential = await this.fetchCredentials(requested);
		} catch {
			this.failAttempt(generation, attempt, "degraded");
			return;
		}
		if (!this.isCurrent(generation, attempt)) {
			return;
		}

		this.credential = credential;
		this.clearReconnectTimer();

		const granted = new Set(credential.admittedProductIds);
		const admitted = requested
			.filter((id) => granted.has(id))
			.slice(0, MAX_STOCK_TOPICS);
		const inboxTopic = wantsInbox ? credential.inboxTopic : null;
		const expected = new Set<string>();
		for (const id of admitted) {
			expected.add(`stock:${id}`);
		}
		if (inboxTopic) {
			expected.add(inboxTopic);
		}

		for (const topic of [...this.channels.keys()]) {
			if (!expected.has(topic)) {
				void this.removeChannel(topic);
			}
		}
		for (const [topic, channel] of [...this.acknowledged]) {
			if (this.channels.get(topic) !== channel || !expected.has(topic)) {
				this.acknowledged.delete(topic);
			}
		}
		this.expectedTopics = expected;
		this.denied =
			requestedAll.length > MAX_STOCK_TOPICS ||
			requested.some((id) => !granted.has(id)) ||
			(wantsInbox && !inboxTopic);

		if (expected.size === 0) {
			this.clearRenewalTimer();
			await this.disconnectIfIdle();
			if (!this.isCurrent(generation, attempt)) {
				return;
			}
			this.status = "rest-only";
			return;
		}

		const client = this.ensureClient(env);
		if (!this.scheduleRenewal()) {
			this.failAttempt(generation, attempt, "degraded");
			return;
		}
		try {
			await client.realtime.setAuth(credential.accessToken);
		} catch {
			this.failAttempt(generation, attempt, "degraded");
			return;
		}
		if (!this.isCurrent(generation, attempt)) {
			return;
		}

		this.transportAllowed = true;
		const opened = await this.ensureTransportOpen(generation, attempt);
		if (!this.isCurrent(generation, attempt)) {
			return;
		}
		if (!opened) {
			this.failAttempt(generation, attempt, "degraded");
			return;
		}

		for (const topic of expected) {
			if (!this.isCurrent(generation, attempt)) {
				return;
			}
			if (this.channels.has(topic)) {
				continue;
			}
			await this.join(client, topic, generation, attempt);
		}
		if (!this.isCurrent(generation, attempt)) {
			return;
		}
		this.refreshStatus();
	}

	private async join(
		client: SupabaseClient,
		topic: string,
		generation: number,
		attempt: number,
	): Promise<void> {
		if (!this.isCurrent(generation, attempt)) {
			return;
		}
		await this.joinScheduler.acquire(() =>
			this.isCurrent(generation, attempt),
		);
		if (!this.isCurrent(generation, attempt)) {
			return;
		}
		if (!this.transportReady()) {
			this.failAttempt(generation, attempt, "connecting");
			return;
		}
		const isStock = topic.startsWith("stock:");
		if (isStock) {
			if (!this.stockRefs.has(topic.slice("stock:".length))) {
				return;
			}
		} else if (this.inboxRefs.size === 0) {
			return;
		}
		if (this.channels.has(topic)) {
			return;
		}
		const event = isStock ? STOCK_EVENT : INBOX_EVENT;
		const channel = client.channel(topic, {
			config: { private: true, broadcast: { self: false } },
		});
		channel.on("broadcast", { event }, (message: unknown) => {
			if (!this.isCurrent(generation, attempt)) {
				return;
			}
			if (this.channels.get(topic) !== channel) {
				return;
			}
			this.handleSignal(topic, event, message);
		});
		this.channels.set(topic, channel);
		channel.subscribe((state: string) => {
			if (!this.isCurrent(generation, attempt)) {
				return;
			}
			if (this.channels.get(topic) !== channel) {
				return;
			}
			if (state === "SUBSCRIBED") {
				this.reconnectAttempt = 0;
				this.acknowledged.set(topic, channel);
				this.refreshStatus();
			} else if (
				state === "CHANNEL_ERROR" ||
				state === "TIMED_OUT" ||
				state === "CLOSED"
			) {
				this.failAttempt(generation, attempt, "connecting");
			}
		});
	}

	private refreshStatus(): void {
		if (!this.started) {
			return;
		}
		if (!this.env()) {
			this.status = "degraded";
			return;
		}
		if (this.expectedTopics.size === 0 || this.denied) {
			this.status = "rest-only";
			return;
		}
		const ready = [...this.expectedTopics].every((topic) => {
			const channel = this.channels.get(topic);
			return channel !== undefined && this.acknowledged.get(topic) === channel;
		});
		this.status = ready ? "live" : "connecting";
	}

	private handleSignal(topic: string, event: string, payload: unknown): void {
		const signal: RealtimeSignal = { topic, event, payload };
		const listenerSet = topic.startsWith("stock:")
			? this.stockRefs.get(topic.slice("stock:".length))
			: this.inboxRefs;
		if (listenerSet) {
			for (const listener of [...listenerSet]) {
				try {
					listener(signal);
				} catch {
					// One throwing listener must not skip the others or the reconcile.
				}
			}
		}
		this.markDirty();
	}

	private failAttempt(
		generation: number,
		attempt: number,
		status: RealtimeStatus,
	): void {
		if (!this.isCurrent(generation, attempt)) {
			return;
		}
		this.attempt += 1;
		this.credential = null;
		this.expectedTopics.clear();
		this.acknowledged.clear();
		this.denied = false;
		this.clearRenewalTimer();
		this.teardown = this.teardownTransport();
		this.status = status;
		this.scheduleReconnect();
	}

	private scheduleReconnect(): void {
		if (!this.started || this.reconnectTimer) {
			return;
		}
		this.clearRenewalTimer();
		const delay = reconnectDelay(this.reconnectAttempt, this.random);
		this.reconnectAttempt += 1;
		this.reconnectTimer = this.timers.setTimeout(() => {
			this.reconnectTimer = null;
			const generation = this.generation;
			void this.reconnect(generation);
		}, delay);
	}

	private async reconnect(generation: number): Promise<void> {
		await this.teardown;
		if (!this.started || generation !== this.generation) {
			return;
		}
		await this.sync();
		this.reconcileAfterReconnect(generation);
	}

	private reconcileAfterReconnect(generation: number): void {
		if (generation !== this.generation || !this.started) {
			return;
		}
		if (this.visibility() === "hidden") {
			return;
		}
		void this.runReconcile();
	}

	private scheduleRenewal(): boolean {
		this.clearRenewalTimer();
		if (!this.credential) {
			return false;
		}
		const expiresAt = Date.parse(this.credential.expiresAt);
		if (Number.isNaN(expiresAt) || expiresAt <= this.now()) {
			return false;
		}
		const delay = Math.min(
			MAX_RENEW_DELAY_MS,
			Math.max(MIN_RENEW_DELAY_MS, expiresAt - RENEW_LEAD_MS - this.now()),
		);
		this.renewTimer = this.timers.setTimeout(() => {
			this.renewTimer = null;
			void this.sync();
		}, delay);
		return true;
	}

	private scheduleReconcile(force = false): void {
		if (!this.started || this.visibility() === "hidden") {
			return;
		}
		if (this.reconcileTimer && !force) {
			return;
		}
		this.clearReconcileTimer();
		const delay = RECONCILE_INTERVAL_MS + this.random() * RECONCILE_JITTER_MS;
		this.reconcileTimer = this.timers.setTimeout(() => {
			this.reconcileTimer = null;
			void this.runReconcile();
		}, delay);
	}

	private async runReconcile(): Promise<void> {
		if (!this.started) {
			return;
		}
		if (this.visibility() === "hidden") {
			this.clearReconcileTimer();
			return;
		}
		if (this.reconcileInFlight) {
			this.dirty = true;
			return;
		}
		const run = ++this.reconcileRun;
		const controller = new AbortController();
		this.reconcileController = controller;
		this.reconcileInFlight = true;
		const context: ReconcileContext = {
			signal: controller.signal,
			isCurrent: () => run === this.reconcileRun && this.started,
		};
		try {
			for (const listener of [...this.reconcileListeners]) {
				if (!context.isCurrent()) {
					return;
				}
				try {
					await listener(context);
				} catch {
					// One failed resource must not block the others; the next cycle retries.
				}
				if (!context.isCurrent()) {
					return;
				}
			}
		} finally {
			if (run !== this.reconcileRun) {
				return;
			}
			this.reconcileInFlight = false;
			this.reconcileController = null;
			this.scheduleReconcile();
			if (this.dirty) {
				this.dirty = false;
				this.scheduleFollowUp();
			}
		}
	}

	private invalidateReconcile(): void {
		this.reconcileRun += 1;
		this.reconcileController?.abort();
		this.reconcileController = null;
		this.reconcileInFlight = false;
	}

	private markDirty(): void {
		if (!this.started) {
			return;
		}
		if (this.reconcileInFlight) {
			this.dirty = true;
			return;
		}
		if (this.signalTimer || this.followUp) {
			return;
		}
		this.signalTimer = this.timers.setTimeout(() => {
			this.signalTimer = null;
			void this.runReconcile();
		}, 0);
	}

	private scheduleFollowUp(): void {
		if (!this.started || this.followUp) {
			return;
		}
		this.followUp = true;
		this.followUpTimer = this.timers.setTimeout(() => {
			this.followUpTimer = null;
			this.followUp = false;
			void this.runReconcile();
		}, 0);
	}

	private ensureClient(env: PublicEnv): SupabaseClient {
		if (!this.client) {
			this.client = this.createClientImpl(env.url, env.publishableKey);
			this.guardTransport(this.client);
		}
		return this.client;
	}

	private transport(): RealtimeTransport | null {
		return this.client
			? (this.client.realtime as unknown as RealtimeTransport)
			: null;
	}

	private guardTransport(client: SupabaseClient): void {
		if (this.transportGuarded) {
			return;
		}
		this.transportGuarded = true;
		const realtime = client.realtime as unknown as RealtimeTransport;
		const connect = realtime.connect?.bind(realtime);
		if (connect) {
			realtime.connect = () => {
				if (this.transportAllowed && this.started) {
					connect();
				}
			};
		}
		const adapter = realtime.socketAdapter;
		const socket = adapter?.getSocket?.();
		if (socket) {
			socket.reconnectAfterMs = () => SDK_RECONNECT_SUPPRESSION_MS;
		}
		adapter?.onOpen?.(() => this.resolveOpenWaiters(true));
		adapter?.onClose?.(() => {
			if (!this.transportAllowed) {
				return;
			}
			this.failAttempt(this.generation, this.attempt, "connecting");
		});
	}

	private transportReady(): boolean {
		const realtime = this.transport();
		if (!realtime) {
			return false;
		}
		return typeof realtime.isConnected === "function"
			? realtime.isConnected()
			: true;
	}

	private async ensureTransportOpen(
		generation: number,
		attempt: number,
	): Promise<boolean> {
		const realtime = this.transport();
		if (!realtime) {
			return false;
		}
		if (this.transportReady()) {
			return true;
		}
		if (typeof realtime.connect !== "function") {
			return true;
		}
		const opened = await this.waitForOpen();
		if (!this.isCurrent(generation, attempt)) {
			return false;
		}
		return opened && this.transportReady();
	}

	private waitForOpen(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			const waiter: OpenWaiter = {
				resolve: (opened) => {
					if (waiter.timer) {
						this.timers.clearTimeout(waiter.timer);
						waiter.timer = null;
					}
					resolve(opened);
				},
				timer: this.timers.setTimeout(() => {
					this.openWaiters.delete(waiter);
					waiter.resolve(false);
				}, TRANSPORT_OPEN_TIMEOUT_MS),
			};
			this.openWaiters.add(waiter);
			try {
				this.transport()?.connect?.();
			} catch {
				this.openWaiters.delete(waiter);
				waiter.resolve(false);
			}
		});
	}

	private resolveOpenWaiters(opened: boolean): void {
		for (const waiter of [...this.openWaiters]) {
			this.openWaiters.delete(waiter);
			waiter.resolve(opened);
		}
	}

	private async disconnectIfIdle(): Promise<void> {
		if (this.channels.size > 0 || !this.client) {
			return;
		}
		this.teardown = this.teardownTransport();
		await this.teardown;
	}

	private teardownTransport(): Promise<void> {
		const realtime = this.transport();
		const conn = realtime?.socketAdapter?.getSocket?.()?.conn ?? null;
		this.transportAllowed = false;
		this.resolveOpenWaiters(false);
		void this.removeAllChannels();
		if (!realtime) {
			return Promise.resolve();
		}
		realtime.reconnectTimer?.reset?.();
		let disconnected: Promise<unknown> | unknown;
		try {
			disconnected = realtime.disconnect?.();
		} catch {
			disconnected = undefined;
		}
		return Promise.resolve(disconnected)
			.catch(() => undefined)
			.then(() => this.waitForTransportClosed(conn))
			.then(() => {
				realtime.reconnectTimer?.reset?.();
				queueMicrotask(() => realtime.reconnectTimer?.reset?.());
			});
	}

	private waitForTransportClosed(
		conn: TransportConnection | null,
	): Promise<void> {
		if (!conn || conn.readyState === 3) {
			return Promise.resolve();
		}
		if (!conn.addEventListener) {
			return Promise.resolve();
		}
		return new Promise<void>((resolve) => {
			let settled = false;
			const finish = () => {
				if (settled) {
					return;
				}
				settled = true;
				this.timers.clearTimeout(timer);
				conn.removeEventListener?.("close", finish);
				resolve();
			};
			const timer = this.timers.setTimeout(
				finish,
				TRANSPORT_OPEN_TIMEOUT_MS,
			);
			conn.addEventListener?.("close", finish, { once: true });
		});
	}

	private isCurrent(generation: number, attempt: number): boolean {
		return (
			this.started && generation === this.generation && attempt === this.attempt
		);
	}

	private removeChannel(topic: string): Promise<void> {
		const channel = this.channels.get(topic);
		if (!channel) {
			return Promise.resolve();
		}
		this.channels.delete(topic);
		this.acknowledged.delete(topic);
		if (!this.client) {
			return Promise.resolve();
		}
		return Promise.resolve(this.client.removeChannel(channel)).then(
			() => undefined,
			() => undefined,
		);
	}

	private removeAllChannels(): Promise<void> {
		const topics = [...this.channels.keys()];
		return Promise.all(topics.map((topic) => this.removeChannel(topic))).then(
			() => undefined,
		);
	}

	private addVisibilityListener(): void {
		if (this.visibilityListening || typeof document === "undefined") {
			return;
		}
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		this.visibilityListening = true;
	}

	private removeVisibilityListener(): void {
		if (!this.visibilityListening || typeof document === "undefined") {
			return;
		}
		document.removeEventListener(
			"visibilitychange",
			this.handleVisibilityChange,
		);
		this.visibilityListening = false;
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer) {
			this.timers.clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private clearRenewalTimer(): void {
		if (this.renewTimer) {
			this.timers.clearTimeout(this.renewTimer);
			this.renewTimer = null;
		}
	}

	private clearReconcileTimer(): void {
		if (this.reconcileTimer) {
			this.timers.clearTimeout(this.reconcileTimer);
			this.reconcileTimer = null;
		}
	}

	private clearFollowUpTimer(): void {
		if (this.followUpTimer) {
			this.timers.clearTimeout(this.followUpTimer);
			this.followUpTimer = null;
		}
		this.followUp = false;
	}

	private clearRenewalAndReconnect(): void {
		this.clearRenewalTimer();
		this.clearReconnectTimer();
	}

	private clearTimers(): void {
		this.clearRenewalAndReconnect();
		this.clearReconcileTimer();
		this.clearFollowUpTimer();
		if (this.signalTimer) {
			this.timers.clearTimeout(this.signalTimer);
			this.signalTimer = null;
		}
	}
}

export const realtimeManager = new RealtimeConnectionManager();
