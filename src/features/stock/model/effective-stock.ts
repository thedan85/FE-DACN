import type { StockSnapshotState } from "../schema";

/**
 * Display-only effective stock.
 *
 * A Realtime signal is an invalidation hint, never a stock delta and never a
 * payment authority. The numeric value comes from the server REST snapshot;
 * the DTO value rendered by the server component is only a fallback.
 *
 * `stock === null` (including omitted reads, which the store clears to null)
 * and an absent snapshot fall back to the DTO. Readiness, `loading` and `error`
 * are metadata about the Realtime channel and about in-flight reads — not a
 * trust gate for a number already read from the authoritative server. The
 * accepted store retains known stock across denied/capped/rest-only/pending
 * readiness and later read errors, so those values stay usable here. A live
 * `0` is a genuine sold-out state and is preserved.
 */
export function effectiveStock(
	snapshot: StockSnapshotState | undefined,
	serverStock: number | null | undefined,
): number | null {
	if (!snapshot || snapshot.stock == null) return serverStock ?? null;
	return snapshot.stock;
}
