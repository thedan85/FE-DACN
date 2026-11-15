"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { StockSnapshotInterest, StockSnapshotState } from "./schema";
import { stockStore } from "./store";

export function useStockSnapshot(interest: StockSnapshotInterest): StockSnapshotState {
	const { kind, productId } = interest;
	const variantId = interest.kind === "variant" ? interest.variantId : "";
	const subscribe = useCallback((listener: () => void) => {
		const resource: StockSnapshotInterest = kind === "variant"
			? { kind, productId, variantId }
			: { kind, productId };
		const unsubscribe = stockStore.subscribe(listener);
		const release = stockStore.register(resource);
		return () => { unsubscribe(); release(); };
	}, [kind, productId, variantId]);
	const getSnapshot = useCallback(() => stockStore.getSnapshot(kind === "variant"
		? { kind, productId, variantId }
		: { kind, productId }), [kind, productId, variantId]);
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
