import { afterEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { roleFixture, roleDetailFixture, permissionFixture } from "../test-fixtures";
import { listRoles, getRole, createRole, updateRole, replaceRolePermissions, deleteRole, listPermissions } from "./roles.api";

vi.mock("@/features/auth/session", () => ({ getAuthHeaders: () => ({ Authorization: "Bearer test-token" }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function respond(data: unknown, status = 200) {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: status, message: "OK", data }), { status }));
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

it("lists roles without paging or per-role detail requests", async () => {
	const fetch = respond([roleFixture]);
	expect(await listRoles()).toEqual([roleFixture]);
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(String(fetch.mock.calls[0][0])).toBe("http://localhost:8080/api/v1/admin/roles");
});

it("lists permissions with nullable descriptions", async () => {
	respond([permissionFixture]);
	expect(await listPermissions()).toEqual([permissionFixture]);
});

it("encodes opaque ids and sends auth/English headers without cookies", async () => {
	const fetch = respond(roleDetailFixture);
	expect(await getRole("role/team%42")).toEqual(roleDetailFixture);
	const [url, init] = fetch.mock.calls[0];
	expect(new URL(String(url)).pathname).toBe("/api/v1/admin/roles/role%2Fteam%2542");
	expect(init.headers.get("Authorization")).toBe("Bearer test-token");
	expect(init.headers.get("Accept-Language")).toBe("en");
	expect(init.credentials).toBeUndefined();
});

it("accepts 201 creates and uses only the returned role id", async () => {
	const fetch = respond({ ...roleDetailFixture, permissions: [] }, 201);
	const result = await createRole({ code: "Support", name: "Support" });
	expect(result.roleId).toBe("generated-role/42%");
	expect(fetch.mock.calls[0][1].method).toBe("POST");
	expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ code: "Support", name: "Support" });
});

it("PATCHes changed fields, preserving a blank description to clear it", async () => {
	const fetch = respond(roleDetailFixture);
	await updateRole("role-admin", { description: "" });
	expect(fetch.mock.calls[0][1].method).toBe("PATCH");
	expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ description: "" });
});

it.each([
	{ ids: ["opaque/permission", "opaque/permission"], expected: ["opaque/permission"] },
	{ ids: [], expected: [] },
])("replaces with unique permission ids, including an empty set: $ids", async ({ ids, expected }) => {
	const fetch = respond(roleDetailFixture);
	await replaceRolePermissions("role-admin", ids);
	expect(fetch.mock.calls[0][1].method).toBe("PUT");
	expect(new URL(String(fetch.mock.calls[0][0])).pathname).toBe("/api/v1/admin/roles/role-admin/permissions");
	expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ permissionIds: expected });
});

it("validates HTTP 200 null delete data", async () => {
	const fetch = respond(null);
	await expect(deleteRole("role-admin")).resolves.toBeUndefined();
	expect(fetch.mock.calls[0][1].method).toBe("DELETE");
});

it("rejects malformed response data", async () => {
	respond({ roleId: "role-admin" });
	await expect(getRole("role-admin")).rejects.toBeInstanceOf(ApiError);
});
