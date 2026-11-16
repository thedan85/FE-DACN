"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import type { StockSnapshotInterest, StockSnapshotState } from "./schema";
import { stockInterestKey, stockStore } from "./store";

export { stockInterestKey };

export type StockSnapshotsById = ReadonlyMap<string, StockSnapshotState>;

type Cache = {
	signature: string;
	states: StockSnapshotState[];
	result: StockSnapshotsById;
};

/**
 * Plural counterpart of `useStockSnapshot`.
 *
 * Registers every interest through the same shared store (so a catalog
 * viewport still issues one batched snapshot, not one per card) and returns a
 * referentially stable map for `useSyncExternalStore`. The map is rebuilt only
 * when the interest set or one of the underlying frozen entry states changes,
 * which prevents render loops. React identity is keyed by the serialized
 * interest set, so a fresh array with the same interests keeps one subscription.
 */
export function useStockSnapshots(
	interests: readonly StockSnapshotInterest[],
): StockSnapshotsById {
	const signature = JSON.stringify(interests.map(stockInterestKey));
	const cacheRef = useRef<Cache | null>(null);

	const subscribe = useCallback((listener: () => void) => {
		const unsubscribe = stockStore.subscribe(listener);
		const releases = interests.map((interest) => stockStore.register(interest));
		return () => {
			unsubscribe();
			for (const release of releases) release();
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by serialized interest set
	}, [signature]);

	const getSnapshot = useCallback((): StockSnapshotsById => {
		const states = interests.map((interest) => stockStore.getSnapshot(interest));
		const cached = cacheRef.current;
		if (
			cached &&
			cached.signature === signature &&
			cached.states.length === states.length &&
			states.every((state, index) => state === cached.states[index])
		) {
			return cached.result;
		}
		const result: StockSnapshotsById = new Map(
			interests.map((interest, index) => [stockInterestKey(interest), states[index]]),
		);
		cacheRef.current = { signature, states, result };
		return result;
	// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by serialized interest set
	}, [signature]);

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
