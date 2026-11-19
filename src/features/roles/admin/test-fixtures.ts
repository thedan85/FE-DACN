/** Test-only DTO fixtures: seeded IDs are opaque, not inferred from codes. */
export const roleFixture = {
	roleId: "role-admin",
	code: "admin",
	name: "Administrator",
	description: null,
	system: true,
	createdAt: "2026-11-09T14:21:32.920958Z",
	updatedAt: "2026-11-09T14:21:32.920958Z",
};

export const permissionFixture = {
	permissionId: "PERM_user-read",
	code: "user:read",
	name: "Read User",
	resource: "user",
	action: "read",
	description: null,
	createdAt: "2026-11-09T14:21:33.022723Z",
	updatedAt: "2026-11-09T14:21:33.022723Z",
};

export const customRoleFixture = {
	...roleFixture,
	roleId: "generated-role/42%",
	code: "support",
	name: "Support",
	system: false,
};

export const roleDetailFixture = { ...customRoleFixture, permissions: [permissionFixture] };
