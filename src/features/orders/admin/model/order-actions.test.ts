import { expect, it } from "vitest";

import { getOrderActions, hasOrderPermission } from "./order-actions";

const ALL_PERMISSIONS = ["order:read", "order:update", "order:complete"];

it("requires the exact permission code", () => {
	expect(hasOrderPermission(["order:read"], "order:read")).toBe(true);
	expect(hasOrderPermission(["order:read:extra"], "order:read")).toBe(false);
	expect(hasOrderPermission(undefined, "order:read")).toBe(false);
});

it("offers accept and reject for a pending order only with order:update", () => {
	expect(getOrderActions("PENDING", ["order:update"])).toEqual([
		"accept",
		"reject",
	]);
	expect(getOrderActions("PENDING", ["order:read"])).toEqual([]);
});

it("offers completion for every non-terminal order only with order:complete", () => {
	for (const status of ["PENDING", "CONFIRMED", "SHIPPING"] as const) {
		expect(getOrderActions(status, ALL_PERMISSIONS)).toContain("complete");
		expect(getOrderActions(status, ["order:update"])).not.toContain("complete");
	}

	for (const status of ["COMPLETED", "CANCELLED"] as const) {
		expect(getOrderActions(status, ALL_PERMISSIONS)).toEqual([]);
	}
});
