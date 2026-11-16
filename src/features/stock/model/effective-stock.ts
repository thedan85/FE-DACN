import type { StockSnapshotState } from "../schema";

/**
 * Display-only effective stock.
 *
 * A realtime signal is an invalidation hint, never a stock delta and never a
 * payment authority. The numeric value comes from the server: the shared REST
 * snapshot first, then the DTO value rendered by the server component.
 *
 * `stock === null`, `omitted`, `loading`, `error` and non-admitted readiness
 * all mean "no trustworthy live value yet", so they resolve to the server
 * value — never zero and never an invented delta. A genuine live `0` is a
 * real sold-out state and is kept.
 */
export function effectiveStock(
	snapshot: StockSnapshotState | undefined,
	serverStock: number | null | undefined,
): number | null {
	const serverValue = serverStock ?? null;
	if (!snapshot) return serverValue;
	if (snapshot.stock == null || snapshot.omitted || snapshot.loading || snapshot.error != null) {
		return serverValue;
	}
	if (
		snapshot.readiness.admission !== "admitted" ||
		!snapshot.readiness.acknowledged ||
		snapshot.readiness.status !== "live"
	) {
		return serverValue;
	}
	return snapshot.stock;
}
