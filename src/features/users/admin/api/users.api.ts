import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import {
	createApiResponseSchema,
	nullDataResponseSchema,
} from "@/lib/api/schema";

import { getAuthHeaders } from "@/features/auth/session";

import {
	UserDetailSchema,
	UserPageSchema,
	type UserAccountStatus,
	type UserDetail,
	type UserPage,
} from "../schema/user.schema";

/**
 * Admin user API (`/admin/users`), mirrored from `docs/admin-users-api.md`.
 *
 * Two contract facts shape this module:
 *
 * - **`page` is zero-based.** The screens keep a 1-based URL page and convert
 *   once at the edge through `toApiPage`.
 * - **`sort` is a Spring-style `field,asc|desc` string with a closed whitelist.**
 *   Any other field is a 400, so the type here is a union rather than a free
 *   string; `listing-query` validates untrusted URL values before they reach it.
 *
 * Every call sends `Accept-Language: en` because the backend localises its error
 * messages and the UI copy is English. No call uses `credentials: "include"`:
 * these endpoints authenticate with the bearer token only.
 */

const userPageResponseSchema = createApiResponseSchema(UserPageSchema);

const userDetailResponseSchema = createApiResponseSchema(UserDetailSchema);

export const ADMIN_USER_SORT_FIELDS = [
	"email",
	"name",
	"roleCode",
	"status",
	"lastLogin",
	"createdAt",
] as const;

export type AdminUserSortField = (typeof ADMIN_USER_SORT_FIELDS)[number];
export type AdminUserSortDirection = "asc" | "desc";
export type AdminUserSort =
	`${AdminUserSortField},${AdminUserSortDirection}`;

export type ListAdminUsersParams = {
	/** Case-insensitive match on email or the current-role profile name. */
	keyword?: string;
	/** Unknown role codes return an empty page, not an error. */
	roleCode?: string;
	/** Omit for the "All" tab. */
	status?: UserAccountStatus;
	sort?: AdminUserSort;
	/** 0-based page index. */
	page: number;
	size: number;
};

export type CreateAdminUserInput = {
	email: string;
	password: string;
	name: string;
	phone: string;
	address?: string;
	roleCode: string;
};

function adminUserHeaders(): Record<string, string> {
	return {
		...getAuthHeaders(),
		// The backend reads its message bundle from this header; without it a
		// Vietnamese server locale would put Vietnamese text in an English UI.
		"Accept-Language": "en",
	};
}

function encodedUserId(userId: string): string {
	return encodeURIComponent(userId);
}

export async function listAdminUsers(
	params: ListAdminUsersParams,
): Promise<UserPage> {
	const search = new URLSearchParams();

	if (params.keyword) {
		search.set("keyword", params.keyword);
	}

	if (params.roleCode) {
		search.set("roleCode", params.roleCode);
	}

	if (params.status) {
		search.set("status", params.status);
	}

	if (params.sort) {
		search.set("sort", params.sort);
	}

	search.set("page", String(params.page));
	search.set("size", String(params.size));

	const payload = await apiFetch<unknown>(`admin/users?${search.toString()}`, {
		headers: adminUserHeaders(),
	});

	return parseOrThrow(userPageResponseSchema, payload, "The user list response")
		.data;
}

export async function getAdminUser(userId: string): Promise<UserDetail> {
	const payload = await apiFetch<unknown>(
		`admin/users/${encodedUserId(userId)}`,
		{ headers: adminUserHeaders() },
	);

	return parseOrThrow(userDetailResponseSchema, payload, "The user response")
		.data;
}

export async function createAdminUser(
	input: CreateAdminUserInput,
): Promise<UserDetail> {
	const payload = await apiFetch<unknown>("admin/users", {
		method: "POST",
		headers: adminUserHeaders(),
		body: JSON.stringify(input),
	});

	return parseOrThrow(
		userDetailResponseSchema,
		payload,
		"The created user response",
	).data;
}

/** Locks or unlocks an account. Locking revokes the user's refresh tokens. */
export async function setAdminUserStatus(
	userId: string,
	status: UserAccountStatus,
): Promise<UserDetail> {
	const payload = await apiFetch<unknown>(
		`admin/users/${encodedUserId(userId)}/status`,
		{
			method: "PATCH",
			headers: adminUserHeaders(),
			body: JSON.stringify({ status }),
		},
	);

	return parseOrThrow(
		userDetailResponseSchema,
		payload,
		"The updated user response",
	).data;
}

export async function setAdminUserRole(
	userId: string,
	roleCode: string,
): Promise<UserDetail> {
	const payload = await apiFetch<unknown>(
		`admin/users/${encodedUserId(userId)}/role`,
		{
			method: "PATCH",
			headers: adminUserHeaders(),
			body: JSON.stringify({ roleCode }),
		},
	);

	return parseOrThrow(
		userDetailResponseSchema,
		payload,
		"The updated user response",
	).data;
}

/**
 * Soft-deletes the account. The endpoint answers HTTP 200 with `data: null`
 * (not 204), and the email stays reserved for a future create.
 */
export async function deleteAdminUser(userId: string): Promise<void> {
	const payload = await apiFetch<unknown>(
		`admin/users/${encodedUserId(userId)}`,
		{
			method: "DELETE",
			headers: adminUserHeaders(),
		},
	);

	parseOrThrow(
		nullDataResponseSchema,
		payload,
		"The delete-user response",
	);
}
