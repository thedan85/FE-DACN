import { expect, it } from "vitest";

import { DASHBOARD_RANGES, parseDashboardRange } from "./dashboard.api";

/**
 * The dashboard's URL carries the selected window. Only the backend's three
 * accepted values may reach it — anything else is a 400 — so a hand-edited or
 * stale link falls back to 30 days instead.
 */

it("accepts exactly the backend's three windows", () => {
	expect(DASHBOARD_RANGES).toEqual([7, 30, 90]);
	expect(parseDashboardRange("7")).toBe(7);
	expect(parseDashboardRange("30")).toBe(30);
	expect(parseDashboardRange("90")).toBe(90);
});

it("falls back to 30 days for missing or unknown values", () => {
	expect(parseDashboardRange(null)).toBe(30);
	expect(parseDashboardRange(undefined)).toBe(30);
	expect(parseDashboardRange("")).toBe(30);
	expect(parseDashboardRange("14")).toBe(30);
	expect(parseDashboardRange("nonsense")).toBe(30);
});
