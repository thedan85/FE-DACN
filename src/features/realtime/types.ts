export type RealtimeStatus =
	| "disabled"
	| "connecting"
	| "live"
	| "rest-only"
	| "degraded";

/** A Realtime signal is an invalidation hint, never trusted state. */
export type RealtimeSignal = {
	topic: string;
	event: string;
	payload: unknown;
};

export type RealtimeListener = (signal: RealtimeSignal) => void;

/** Account-scoped: owners must not commit results once `isCurrent()` is false. */
export type ReconcileContext = {
	signal: AbortSignal;
	isCurrent: () => boolean;
};

export type ReconcileListener = (
	context: ReconcileContext,
) => void | Promise<void>;

export const STOCK_EVENT = "stock.changed";
export const INBOX_EVENT = "inbox.changed";
