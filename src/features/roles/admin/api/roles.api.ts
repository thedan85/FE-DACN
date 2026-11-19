import { z } from "zod";
import { getAuthHeaders } from "@/features/auth/session";
import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import { createApiResponseSchema, nullDataResponseSchema } from "@/lib/api/schema";
import { RoleSummarySchema, RoleDetailSchema, PermissionSchema } from "../schema/role.schema";

export type CreateRoleInput = { code: string; name: string; description?: string };
export type UpdateRoleInput = { name?: string; description?: string };

const rolesResponse = createApiResponseSchema(z.array(RoleSummarySchema));
const roleResponse = createApiResponseSchema(RoleDetailSchema);
const permissionsResponse = createApiResponseSchema(z.array(PermissionSchema));

function headers() {
	return { ...getAuthHeaders(), "Accept-Language": "en" };
}

function rolePath(roleId: string) {
	return `admin/roles/${encodeURIComponent(roleId)}`;
}

export async function listRoles() {
	const payload = await apiFetch<unknown>("admin/roles", { headers: headers() });
	return parseOrThrow(rolesResponse, payload, "The role list response").data;
}

export async function getRole(roleId: string) {
	const payload = await apiFetch<unknown>(rolePath(roleId), { headers: headers() });
	return parseOrThrow(roleResponse, payload, "The role response").data;
}

export async function createRole(input: CreateRoleInput) {
	const payload = await apiFetch<unknown>("admin/roles", {
		method: "POST", headers: headers(), body: JSON.stringify(input),
	});
	return parseOrThrow(roleResponse, payload, "The created role response").data;
}

export async function updateRole(roleId: string, input: UpdateRoleInput) {
	const payload = await apiFetch<unknown>(rolePath(roleId), {
		method: "PATCH", headers: headers(),
		body: JSON.stringify({ name: input.name, description: input.description }),
	});
	return parseOrThrow(roleResponse, payload, "The updated role response").data;
}

export async function replaceRolePermissions(roleId: string, permissionIds: readonly string[]) {
	const payload = await apiFetch<unknown>(`${rolePath(roleId)}/permissions`, {
		method: "PUT", headers: headers(),
		body: JSON.stringify({ permissionIds: [...new Set(permissionIds)] }),
	});
	return parseOrThrow(roleResponse, payload, "The role permissions response").data;
}

export async function deleteRole(roleId: string): Promise<void> {
	const payload = await apiFetch<unknown>(rolePath(roleId), { method: "DELETE", headers: headers() });
	parseOrThrow(nullDataResponseSchema, payload, "The delete role response");
}

export async function listPermissions() {
	const payload = await apiFetch<unknown>("admin/permissions", { headers: headers() });
	return parseOrThrow(permissionsResponse, payload, "The permission list response").data;
}
