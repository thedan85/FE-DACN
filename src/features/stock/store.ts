"use client";

import { realtimeManager, type RealtimeConnectionManager } from "@/features/realtime/connection-manager";
import type { RealtimeInterestState, ReconcileContext } from "@/features/realtime/types";
import { getSessionGeneration, onSessionChange } from "@/features/auth/session";
import { useAuthStore } from "@/stores/auth-store";
import { fetchStockSnapshots } from "./api/stock.api";
import { stockIdSchema, type StockSnapshotInterest, type StockSnapshotState } from "./schema";

type Entry = {
	interest: StockSnapshotInterest;
	refs: number;
	state: StockSnapshotState;
};
type Parent = { refs: number; release: () => void; unobserve: () => void };
const initial: StockSnapshotState = Object.freeze({
	stock: null, stockRevision: null, loading: false, error: null, omitted: false,
	readiness: Object.freeze({ admission: "unavailable", acknowledged: false, status: "disabled" }),
});
function key(interest: StockSnapshotInterest) {
	return JSON.stringify(interest.kind === "product"
		? ["product", interest.productId]
		: ["variant", interest.productId, interest.variantId]);
}
function owner() {
	return JSON.stringify([useAuthStore.getState().user?.userId ?? null, getSessionGeneration()]);
}
function sameReadiness(a: RealtimeInterestState, b: RealtimeInterestState) {
	return a.admission === b.admission && a.acknowledged === b.acknowledged && a.status === b.status;
}

export function createStockStore(manager: RealtimeConnectionManager = realtimeManager) {
	const entries = new Map<string, Entry>();
	const parents = new Map<string, Parent>();
	const listeners = new Set<() => void>();
	let account = owner();
	let generation = 0;
	let controller: AbortController | null = null;
	let flight: Promise<void> | null = null;
	let dirty = false;
	let nextContext: ReconcileContext | undefined;
	let releaseReconcile: (() => void) | undefined;
	let releaseAuth: (() => void) | undefined;
	let releaseSession: (() => void) | undefined;

	function emit() {
		for (const listener of [...listeners]) listener();
	}
	function update(entry: Entry, patch: Partial<StockSnapshotState>) {
		const state = { ...entry.state, ...patch };
		if ((Object.keys(state) as Array<keyof StockSnapshotState>)
			.every((field) => state[field] === entry.state[field])) return;
		entry.state = Object.freeze(state);
		emit();
	}
	function invalidate() {
		generation += 1;
		controller?.abort();
	}
	function accountChanged() {
		const next = owner();
		if (account === next) return;
		account = next;
		invalidate();
		for (const entry of [...entries.values()]) {
			// The provider owns manager account changes; old-account ACKs are not readiness.
			update(entry, initial);
		}
		void request();
	}
	function invalidateHint() {
		// Foundation owns the next signal/ACK read; this listener only fences stale work.
		invalidate();
	}
	function observeParent(productId: string, readiness: RealtimeInterestState) {
		const affected = [...entries.values()].filter((entry) => entry.interest.productId === productId);
		if (!affected.some((entry) => !sameReadiness(entry.state.readiness, readiness))) return;
		// Readiness is not a stock change; foundation's ACK barrier owns fresh reads.
		for (const entry of affected) {
			if (!sameReadiness(entry.state.readiness, readiness)) update(entry, { readiness });
		}
	}
	async function wave(context?: ReconcileContext) {
		const version = generation;
		const accountAtStart = account;
		const resources = [...entries.values()];
		const products = new Set(resources.filter((entry) => entry.interest.kind === "product")
			.map((entry) => entry.interest.productId));
		const variants = new Set(resources.flatMap((entry) =>
			entry.interest.kind === "variant" ? [entry.interest.variantId] : []));
		const ids = [...new Set([...products, ...variants])].sort();
		const active = new AbortController();
		controller = active;
		const abort = () => active.abort();
		context?.signal.addEventListener("abort", abort, { once: true });
		if (context?.signal.aborted) abort();
		const current = () => generation === version && accountAtStart === owner() &&
			!active.signal.aborted && (!context || (context.isCurrent() && !context.signal.aborted));
		try {
			for (const entry of resources) update(entry, { loading: true, error: null });
			for (let offset = 0; offset < ids.length && current(); offset += 100) {
				const chunk = ids.slice(offset, offset + 100);
				const input = {
					productIds: chunk.filter((id) => products.has(id)),
					variantIds: chunk.filter((id) => variants.has(id)),
				};
				const result = await fetchStockSnapshots(input, active.signal);
				if (!current()) return;
				const chunkProducts = new Set(input.productIds);
				const chunkVariants = new Set(input.variantIds);
				for (const entry of resources) {
					if (!current()) return;
					if (entries.get(key(entry.interest)) !== entry) continue;
					const interest = entry.interest;
					if (interest.kind === "product" ? !chunkProducts.has(interest.productId) : !chunkVariants.has(interest.variantId)) continue;
					const variantRow = interest.kind === "variant"
						? result.variants.find((row) => row.variantId === interest.variantId && row.productId === interest.productId)
						: undefined;
					const found = interest.kind === "product"
						? result.products.find((row) => row.productId === interest.productId)
						: variantRow;
					update(entry, {
						stock: found?.stock ?? null,
						stockRevision: variantRow?.stockRevision ?? null,
						omitted: !found, loading: false, error: null,
					});
				}
			}
		} catch (error) {
			if (current()) {
				// A failed read retains real known data, never an invented zero or availability.
				for (const entry of resources) {
					if (entries.get(key(entry.interest)) === entry) update(entry, { error, loading: false });
				}
			}
		} finally {
			context?.signal.removeEventListener("abort", abort);
			if (controller === active) controller = null;
			for (const entry of resources) {
				if (entries.get(key(entry.interest)) === entry) update(entry, { loading: false });
			}
		}
	}
	async function drain() {
		while (dirty) {
			dirty = false;
			accountChanged();
			const context = nextContext;
			// Capture a fresh full wave after every requested follow-up, not a stale queue.
			if (entries.size) await wave(context);
		}
	}
	function request(context?: ReconcileContext): Promise<void> {
		dirty = true;
		nextContext = context;
		if (!flight) {
			// Install ownership before callbacks can reenter; coalesce same-turn registrations.
			flight = Promise.resolve().then(drain).finally(() => {
				flight = null;
				if (dirty) return request(nextContext);
			});
		}
		return flight;
	}
	const store = {
		register(interest: StockSnapshotInterest): () => void {
			stockIdSchema.parse(interest.productId);
			if (interest.kind === "variant") stockIdSchema.parse(interest.variantId);
			accountChanged();
			const id = key(interest);
			let entry = entries.get(id);
			if (!entry) {
				entry = { interest: { ...interest }, refs: 0, state: initial };
				entries.set(id, entry);
			}
			entry.refs += 1;
			if (entry.refs === 1) {
				invalidate();
				if (!releaseReconcile) {
					account = owner();
					releaseReconcile = manager.onReconcile((context) => request(context));
					releaseAuth = useAuthStore.subscribe(accountChanged);
					releaseSession = onSessionChange(accountChanged);
				}
				let parent = parents.get(interest.productId);
				if (!parent) {
					parent = { refs: 0, release: () => {}, unobserve: () => {} };
					parents.set(interest.productId, parent);
					parent.unobserve = manager.onInterestState(
						{ kind: "stock", productId: interest.productId },
						(readiness) => observeParent(interest.productId, readiness),
					);
					parent.release = manager.subscribeStock(interest.productId, invalidateHint);
				}
				parent.refs += 1;
				const readiness = manager.getInterestState({ kind: "stock", productId: interest.productId });
				if (!sameReadiness(entry.state.readiness, readiness)) update(entry, { readiness });
				void request();
			}
			let released = false;
			return () => {
				if (released) return;
				released = true;
				if (!entry || --entry.refs > 0) return;
				entries.delete(id);
				invalidate();
				const parent = parents.get(interest.productId);
				if (parent && --parent.refs === 0) {
					parents.delete(interest.productId);
					parent.unobserve();
					parent.release();
				}
				if (entries.size === 0) {
					releaseReconcile?.();
					releaseAuth?.();
					releaseSession?.();
					releaseReconcile = undefined;
					releaseAuth = undefined;
					releaseSession = undefined;
				}
				void request();
				emit();
			};
		},
		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		getSnapshot(interest: StockSnapshotInterest): StockSnapshotState {
			return entries.get(key(interest))?.state ?? initial;
		},
		/** Explicit invalidate-and-reread used after a server rejection. */
		reconcile(): Promise<void> {
			invalidate();
			return request();
		},
	};
	return store;
}

/** Canonical key shared with the plural hook and display islands. */
export const stockInterestKey = key;

export const stockStore = createStockStore();
