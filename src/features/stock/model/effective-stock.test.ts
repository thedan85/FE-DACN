import { describe, expect, it } from "vitest";

import type { StockSnapshotState } from "../schema";
import { effectiveStock } from "./effective-stock";

const admitted = { admission: "admitted", acknowledged: true, status: "live" } as const;
const denied = { admission: "denied", acknowledged: false, status: "rest-only" } as const;
const pending = { admission: "pending", acknowledged: false, status: "connecting" } as const;
const unavailable = { admission: "unavailable", acknowledged: false, status: "degraded" } as const;
const snapshot = (patch: Partial<StockSnapshotState> = {}): StockSnapshotState => ({
	stock: null,
	stockRevision: null,
	loading: false,
	error: null,
	omitted: false,
	readiness: unavailable,
	...patch,
});

describe("effectiveStock — display-only server value", () => {
	it("uses the REST snapshot for an admitted live read", () => {
		expect(effectiveStock(snapshot({ stock: 0, readiness: admitted }), 5)).toBe(0);
		expect(effectiveStock(snapshot({ stock: 2, readiness: admitted }), 5)).toBe(2);
	});

	it.each([
		["denied snapshot stock 0", snapshot({ stock: 0, readiness: denied })],
		["denied snapshot stock 2", snapshot({ stock: 2, readiness: denied })],
		["rest-only snapshot", snapshot({ stock: 2, readiness: unavailable })],
		["pending snapshot", snapshot({ stock: 2, readiness: pending })],
		["unacknowledged snapshot", snapshot({ stock: 2, readiness: { admission: "admitted", acknowledged: false, status: "connecting" } })],
		["loading snapshot with known stock", snapshot({ stock: 2, loading: true, readiness: pending })],
		["error snapshot with retained known stock", snapshot({ stock: 2, error: new Error("offline"), readiness: denied })],
	] as const)("uses the authoritative REST value on %s", (_label, value) => {
		expect(effectiveStock(value, 9)).toBe(value.stock);
	});

	it.each([
		["null stock", snapshot({ stock: null, readiness: admitted })],
		["omitted read", snapshot({ stock: null, omitted: true, readiness: admitted })],
		["no snapshot", undefined],
	] as const)("falls back to the DTO on %s, never zero", (_label, value) => {
		expect(effectiveStock(value, 5)).toBe(5);
	});

	it("keeps an unknown server value unknown instead of inventing zero", () => {
		expect(effectiveStock(snapshot(), null)).toBeNull();
		expect(effectiveStock(snapshot({ omitted: true }), undefined)).toBeNull();
	});

	it("never treats readiness as payment or live authority", () => {
		// A denied/capped topic still shows the server-read number; readiness
		// only describes hint delivery and must not be promoted to authority.
		expect(effectiveStock(snapshot({ stock: 0, readiness: denied }), 9)).toBe(0);
	});
});
