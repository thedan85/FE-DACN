import { describe, expect, it } from "vitest";

import type { StockSnapshotState } from "../schema";
import { effectiveStock } from "./effective-stock";

const admitted = { admission: "admitted", acknowledged: true, status: "live" } as const;
const snapshot = (patch: Partial<StockSnapshotState> = {}): StockSnapshotState => ({
	stock: null,
	stockRevision: null,
	loading: false,
	error: null,
	omitted: false,
	readiness: { admission: "unavailable", acknowledged: false, status: "degraded" },
	...patch,
});

describe("effectiveStock — display-only server value", () => {
	it("uses the REST snapshot when it is a real admitted read", () => {
		expect(effectiveStock(snapshot({ stock: 0, readiness: admitted }), 5)).toBe(0);
		expect(effectiveStock(snapshot({ stock: 2, readiness: admitted }), 5)).toBe(2);
	});

	it.each([
		["null stock", snapshot({ stock: null, readiness: admitted })],
		["omitted", snapshot({ stock: null, omitted: true, readiness: admitted })],
		["loading", snapshot({ stock: 0, loading: true, readiness: admitted })],
		["error", snapshot({ stock: 0, error: new Error("offline"), readiness: admitted })],
		["pending readiness", snapshot({ stock: 0, readiness: { admission: "pending", acknowledged: false, status: "connecting" } })],
		["denied readiness", snapshot({ stock: 0, readiness: { admission: "denied", acknowledged: false, status: "rest-only" } })],
		["unavailable readiness", snapshot({ stock: 0 })],
		["no snapshot", undefined],
	] as const)("falls back to the server value on %s, never zero", (_label, value) => {
		expect(effectiveStock(value, 5)).toBe(5);
	});

	it("keeps an unknown server value unknown instead of inventing zero", () => {
		expect(effectiveStock(snapshot(), null)).toBeNull();
		expect(effectiveStock(snapshot({ omitted: true }), undefined)).toBeNull();
	});

	it("preserves a legitimate live zero even when the DTO says in stock", () => {
		expect(effectiveStock(snapshot({ stock: 0, readiness: admitted }), 9)).toBe(0);
	});
});
