import { getAuthHeaders } from "@/features/auth/session";
import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import {
	createApiResponseSchema,
	createPageResponseSchema,
	nullDataResponseSchema,
} from "@/lib/api/schema";
import type { PageData } from "@/features/products/types";

import {
	AdminUserDetailSchema,
	AdminUserSchema,
	type AdminUser,
	type AdminUserCreateInput,
	type AdminUserDetail,
} from "../schema/admin-users.schema";

/**
 * Admin User API (`/admin/users`), mirrored from `docs/admin-users-api.md` in
 * the backend repo. `roleCode` is required by this client because the staff
 * directory always shows exactly one role at a time; the backend itself
 * treats it as optional.
 *
 * Pages are zero-based end to end — callers convert from the UI's one-based
 * page before calling. `size` stays well under the 100 ceiling the backend
 * accepts.
 */

const adminUserPageResponseSchema = createApiResponseSchema(
	createPageResponseSchema(AdminUserSchema),
);
const adminUserResponseSchema = createApiResponseSchema(AdminUserDetailSchema);

/**
 * The backend's sort whitelist: `email`, `name`, `roleCode`, `status`,
 * `lastLogin`, `createdAt`, `asc|desc`. Any other field is a 400, so this is a
 * closed template union rather than a free string.
 */
export type AdminUserSortField =
	| "email"
	| "name"
	| "roleCode"
	| "status"
	| "lastLogin"
	| "createdAt";
export type AdminUserSort = `${AdminUserSortField},${"asc" | "desc"}`;

export interface AdminUserListParams {
	/** 0-based page index. */
	page: number;
	size: number;
	roleCode: string;
	/** Case-insensitive substring of email or current-role name. */
	keyword?: string;
	status?: "ACTIVE" | "LOCKED";
	sort?: AdminUserSort;
}

export async function listAdminUsers(
	params: AdminUserListParams,
	signal?: AbortSignal,
): Promise<PageData<AdminUser>> {
	const search = new URLSearchParams({
		page: String(params.page),
		size: String(params.size),
		roleCode: params.roleCode,
	});

	const keyword = params.keyword?.trim();
	if (keyword) {
		search.set("keyword", keyword);
	}
	if (params.status) {
		search.set("status", params.status);
	}
	if (params.sort) {
		search.set("sort", params.sort);
	}

	const payload = await apiFetch<unknown>(`admin/users?${search.toString()}`, {
		headers: getAuthHeaders(),
		signal,
	});

	return parseOrThrow(
		adminUserPageResponseSchema,
		payload,
		"The admin user list response",
	).data;
}

export async function getAdminUser(
	userId: string,
	signal?: AbortSignal,
): Promise<AdminUserDetail> {
	const payload = await apiFetch<unknown>(
		`admin/users/${encodeURIComponent(userId)}`,
		{ headers: getAuthHeaders(), signal },
	);

	return parseOrThrow(
		adminUserResponseSchema,
		payload,
		"The admin user response",
	).data;
}

export async function createAdminUser(
	input: AdminUserCreateInput,
): Promise<AdminUserDetail> {
	const payload = await apiFetch<unknown>("admin/users", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(input),
	});

	return parseOrThrow(
		adminUserResponseSchema,
		payload,
		"The created admin user response",
	).data;
}

export async function setAdminUserStatus(
	userId: string,
	status: "ACTIVE" | "LOCKED",
): Promise<AdminUserDetail> {
	const payload = await apiFetch<unknown>(
		`admin/users/${encodeURIComponent(userId)}/status`,
		{
			method: "PATCH",
			headers: getAuthHeaders(),
			body: JSON.stringify({ status }),
		},
	);

	return parseOrThrow(
		adminUserResponseSchema,
		payload,
		"The updated admin user status response",
	).data;
}

export async function setAdminUserRole(
	userId: string,
	roleCode: string,
): Promise<AdminUserDetail> {
	const payload = await apiFetch<unknown>(
		`admin/users/${encodeURIComponent(userId)}/role`,
		{
			method: "PATCH",
			headers: getAuthHeaders(),
			body: JSON.stringify({ roleCode }),
		},
	);

	return parseOrThrow(
		adminUserResponseSchema,
		payload,
		"The updated admin user role response",
	).data;
}

export async function deleteAdminUser(userId: string): Promise<void> {
	const payload = await apiFetch<unknown>(
		`admin/users/${encodeURIComponent(userId)}`,
		{
			method: "DELETE",
			headers: getAuthHeaders(),
		},
	);

	parseOrThrow(
		nullDataResponseSchema,
		payload,
		"The delete-admin-user response",
	);
}
