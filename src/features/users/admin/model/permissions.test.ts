import { expect, it } from "vitest";

import { USER_PERMISSIONS, hasUserPermission } from "./permissions";

it("names the four user permissions the backend enforces", () => {
	expect(USER_PERMISSIONS).toEqual({
		read: "user:read",
		create: "user:create",
		update: "user:update",
		delete: "user:delete",
	});
});

it("matches exact codes and never treats one as implying another", () => {
	const permissions = ["user:read", "user:update"];

	expect(hasUserPermission(permissions, USER_PERMISSIONS.read)).toBe(true);
	expect(hasUserPermission(permissions, USER_PERMISSIONS.update)).toBe(true);
	expect(hasUserPermission(permissions, USER_PERMISSIONS.create)).toBe(false);
	expect(hasUserPermission(permissions, USER_PERMISSIONS.delete)).toBe(false);
	// A prefix is not a grant.
	expect(hasUserPermission(["user"], USER_PERMISSIONS.read)).toBe(false);
});

it("answers false for a missing or unresolved permission list", () => {
	expect(hasUserPermission(undefined, USER_PERMISSIONS.read)).toBe(false);
	expect(hasUserPermission(null, USER_PERMISSIONS.read)).toBe(false);
	expect(hasUserPermission([], USER_PERMISSIONS.read)).toBe(false);
});
