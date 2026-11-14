import { describe, expect, it } from "vitest";

import { ORDER_PERMISSIONS, hasOrderPermission } from "./order-permissions";

describe("order permissions", () => {
	it("matches the exact code", () => {
		expect(hasOrderPermission([ORDER_PERMISSIONS.read], ORDER_PERMISSIONS.read)).toBe(true);
		expect(hasOrderPermission([ORDER_PERMISSIONS.update], ORDER_PERMISSIONS.update)).toBe(true);
	});

	it("does not infer permission from a prefix or substring", () => {
		expect(hasOrderPermission(["order:read:extra"], ORDER_PERMISSIONS.read)).toBe(false);
		expect(hasOrderPermission(["order:update-any"], ORDER_PERMISSIONS.update)).toBe(false);
	});

	it("denies when the account has no permission list", () => {
		expect(hasOrderPermission(undefined, ORDER_PERMISSIONS.read)).toBe(false);
		expect(hasOrderPermission(null, ORDER_PERMISSIONS.update)).toBe(false);
	});
});
