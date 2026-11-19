import { afterEach, expect, it, vi } from "vitest";

import {
	createAdminRole,
	deleteAdminRole,
	getAdminRole,
	listAdminPermissions,
	listAdminRoles,
	patchAdminRole,
	replaceAdminRolePermissions,
} from "./admin-roles.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

function stubFetch(...responses: unknown[]) {
	const fetch = vi.fn();
	for (const response of responses) {
		fetch.mockResolvedValueOnce(
			new Response(JSON.stringify(response), {
				headers: { "Content-Type": "application/json" },
			}),
		);
	}
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

function ok(data: unknown, code = 200, message = "OK") {
	return { code, message, data };
}

const timestamp = "2026-11-09T14:21:32.965135Z";

// PERM_* values are synthetic opaque fixtures for these tests. Real seeded
// permission IDs are UUIDs; the API treats the IDs as opaque either way.
const productCreate = {
	permissionId: "PERM_product-create",
	code: "product:create",
	name: "Create Product",
	resource: "product",
	action: "create",
	description: null,
	createdAt: "2026-11-09T14:21:33.023724Z",
	updatedAt: "2026-11-09T14:21:33.023724Z",
};

const orderRead = {
	...productCreate,
	permissionId: "PERM_order-read",
	code: "order:read",
	name: "Read Order",
	resource: "order",
	action: "read",
};

const supportSummary = {
	roleId: "ROLE_support",
	code: "support",
	name: "Support",
	description: "Support role",
	system: false,
	createdAt: timestamp,
	updatedAt: "2026-11-09T14:21:32.989221Z",
};

const supportDetail = {
	...supportSummary,
	permissions: [productCreate],
};

it("rolesList_requestsDocumentedPath", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok([supportSummary]));

	const roles = await listAdminRoles();

	const [input] = fetch.mock.calls[0] as [string, RequestInit?];
	expect(new URL(String(input)).pathname).toBe("/api/v1/admin/roles");
	expect(roles).toEqual([supportSummary]);
});

it("roleDetail_requestsOpaqueRoleIdPath", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok(supportDetail));

	const role = await getAdminRole("ROLE_support");

	const [input] = fetch.mock.calls[0] as [string, RequestInit?];
	expect(new URL(String(input)).pathname).toBe(
		"/api/v1/admin/roles/ROLE_support",
	);
	expect(role.permissions).toHaveLength(1);
});

it("permissionsList_requestsDocumentedPath", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok([orderRead, productCreate]));

	const permissions = await listAdminPermissions();

	const [input] = fetch.mock.calls[0] as [string, RequestInit?];
	expect(new URL(String(input)).pathname).toBe("/api/v1/admin/permissions");
	expect(permissions.map((permission) => permission.code)).toEqual([
		"order:read",
		"product:create",
	]);
});

it("createRole_sendsDocumentedCreateBody", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const created = {
		...supportDetail,
		roleId: "ROLE_auditor-new",
		code: "auditor_new",
		name: "Auditor New",
		description: "Temporary role",
		permissions: [],
	};
	const fetch = stubFetch(ok(created, 201, "Created"));

	const role = await createAdminRole({
		code: "AUDITOR_NEW",
		name: "Auditor New",
		description: "Temporary role",
	});

	const [input, init] = fetch.mock.calls[0] as [string, RequestInit];
	expect(new URL(String(input)).pathname).toBe("/api/v1/admin/roles");
	expect(init.method).toBe("POST");
	expect(JSON.parse(String(init.body))).toEqual({
		code: "AUDITOR_NEW",
		name: "Auditor New",
		description: "Temporary role",
	});
	expect(role.roleId).toBe("ROLE_auditor-new");
});

it("patchRole_sendsMetadataOnlyBody", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(
		ok({ ...supportDetail, name: "Support Desk" }),
	);

	await patchAdminRole("ROLE_support", { name: "Support Desk" });

	const [input, init] = fetch.mock.calls[0] as [string, RequestInit];
	expect(new URL(String(input)).pathname).toBe(
		"/api/v1/admin/roles/ROLE_support",
	);
	expect(init.method).toBe("PATCH");
	expect(JSON.parse(String(init.body))).toEqual({ name: "Support Desk" });
});

it("replaceGrants_uniqueifiesAndSortsSenderIds", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	// The frontend sender convention is a unique, ascending ID array; the
	// backend answers with grants sorted by code and ignores request order.
	const fetch = stubFetch(
		ok({ ...supportDetail, permissions: [orderRead, productCreate] }),
	);

	await replaceAdminRolePermissions("ROLE_support", [
		"PERM_product-create",
		"PERM_order-read",
		"PERM_order-read",
	]);

	const [input, init] = fetch.mock.calls[0] as [string, RequestInit];
	expect(new URL(String(input)).pathname).toBe(
		"/api/v1/admin/roles/ROLE_support/permissions",
	);
	expect(init.method).toBe("PUT");
	expect(JSON.parse(String(init.body))).toEqual({
		permissionIds: ["PERM_order-read", "PERM_product-create"],
	});
});

it("replaceGrants_sendsEmptyArrayToClearCustomRole", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch(ok({ ...supportDetail, permissions: [] }));

	await replaceAdminRolePermissions("ROLE_support", []);

	const [, init] = fetch.mock.calls[0] as [string, RequestInit];
	expect(JSON.parse(String(init.body))).toEqual({ permissionIds: [] });
});

it("deleteRole_acceptsNullDataEnvelope", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch({ code: 200, message: "OK", data: null });

	await expect(deleteAdminRole("ROLE_support")).resolves.toBeUndefined();

	const [input, init] = fetch.mock.calls[0] as [string, RequestInit];
	expect(new URL(String(input)).pathname).toBe(
		"/api/v1/admin/roles/ROLE_support",
	);
	expect(init.method).toBe("DELETE");
});
