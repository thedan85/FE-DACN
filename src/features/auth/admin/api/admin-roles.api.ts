import { z } from "zod";

import { getAuthHeaders } from "@/features/auth/session";
import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import {
	createApiResponseSchema,
	nullDataResponseSchema,
} from "@/lib/api/schema";

import {
	AdminPermissionSchema,
	AdminRoleDetailSchema,
	AdminRoleSummarySchema,
	type AdminPermission,
	type AdminRoleDetail,
	type AdminRoleSummary,
} from "../schema/admin-roles.schema";

/**
 * Admin Role API (`/admin/roles`, `/admin/permissions`), mirrored from
 * `docs/admin-roles-api.md` in the backend repo.
 *
 * `roleId`/`permissionId` are opaque business IDs: always use the values the
 * API returns, never a value derived from a code. `PUT /roles/{roleId}/
 * permissions` replaces the whole grant set, and the sender convention here
 * is a unique, ascending array of permission IDs — the backend rejects
 * duplicate IDs with `400` and returns grants sorted by permission code, so
 * callers must not depend on the request order coming back.
 */

const roleListResponseSchema = createApiResponseSchema(
	z.array(AdminRoleSummarySchema),
);
const permissionListResponseSchema = createApiResponseSchema(
	z.array(AdminPermissionSchema),
);
const roleResponseSchema = createApiResponseSchema(AdminRoleDetailSchema);

export interface AdminRoleCreateInput {
	/** Pattern `^[A-Za-z][A-Za-z0-9_]{1,49}$`; stored trimmed and lowercased. */
	code: string;
	/** Max 255 characters, not blank after trimming. */
	name: string;
	/** Max 2000 characters; blank clears to null. */
	description?: string;
}

export interface AdminRolePatchInput {
	/** Not blank after trimming, max 255 characters. */
	name?: string;
	/** Max 2000 characters. A blank string clears the description to null. */
	description?: string;
}

export async function listAdminRoles(): Promise<AdminRoleSummary[]> {
	const payload = await apiFetch<unknown>("admin/roles", {
		headers: getAuthHeaders(),
	});

	return parseOrThrow(
		roleListResponseSchema,
		payload,
		"The admin role list response",
	).data;
}

export async function getAdminRole(roleId: string): Promise<AdminRoleDetail> {
	const payload = await apiFetch<unknown>(
		`admin/roles/${encodeURIComponent(roleId)}`,
		{ headers: getAuthHeaders() },
	);

	return parseOrThrow(
		roleResponseSchema,
		payload,
		"The admin role response",
	).data;
}

export async function listAdminPermissions(): Promise<AdminPermission[]> {
	const payload = await apiFetch<unknown>("admin/permissions", {
		headers: getAuthHeaders(),
	});

	return parseOrThrow(
		permissionListResponseSchema,
		payload,
		"The admin permission list response",
	).data;
}

export async function createAdminRole(
	input: AdminRoleCreateInput,
): Promise<AdminRoleDetail> {
	const payload = await apiFetch<unknown>("admin/roles", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(input),
	});

	return parseOrThrow(
		roleResponseSchema,
		payload,
		"The created admin role response",
	).data;
}

export async function patchAdminRole(
	roleId: string,
	input: AdminRolePatchInput,
): Promise<AdminRoleDetail> {
	const payload = await apiFetch<unknown>(
		`admin/roles/${encodeURIComponent(roleId)}`,
		{
			method: "PATCH",
			headers: getAuthHeaders(),
			body: JSON.stringify(input),
		},
	);

	return parseOrThrow(
		roleResponseSchema,
		payload,
		"The updated admin role response",
	).data;
}

export async function replaceAdminRolePermissions(
	roleId: string,
	permissionIds: string[],
): Promise<AdminRoleDetail> {
	// Sender convention: unique, ascending IDs. The backend sorts the
	// returned grants by permission code and rejects duplicate IDs with 400.
	const uniqueIds = [...new Set(permissionIds)].sort();
	const payload = await apiFetch<unknown>(
		`admin/roles/${encodeURIComponent(roleId)}/permissions`,
		{
			method: "PUT",
			headers: getAuthHeaders(),
			body: JSON.stringify({ permissionIds: uniqueIds }),
		},
	);

	return parseOrThrow(
		roleResponseSchema,
		payload,
		"The updated admin role grants response",
	).data;
}

export async function deleteAdminRole(roleId: string): Promise<void> {
	const payload = await apiFetch<unknown>(
		`admin/roles/${encodeURIComponent(roleId)}`,
		{
			method: "DELETE",
			headers: getAuthHeaders(),
		},
	);

	parseOrThrow(
		nullDataResponseSchema,
		payload,
		"The delete-admin-role response",
	);
}
