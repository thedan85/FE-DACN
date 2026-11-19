import { z } from "zod";

import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import { createApiResponseSchema } from "@/lib/api/schema";

import { getAuthHeaders } from "@/features/auth/session";

import { RoleSchema, type Role } from "../schema/user.schema";

/**
 * Role list for the user screens' role selects.
 *
 * This is the only endpoint this feature uses from the role API. It returns a
 * plain array (not a page) and needs `role:read`; callers that lack the
 * permission fall back to the two built-in staff roles rather than blocking
 * the screen.
 */

const roleListResponseSchema = createApiResponseSchema(z.array(RoleSchema));

export async function listAdminRoles(): Promise<Role[]> {
	const payload = await apiFetch<unknown>("admin/roles", {
		headers: {
			...getAuthHeaders(),
			"Accept-Language": "en",
		},
	});

	return parseOrThrow(roleListResponseSchema, payload, "The role list response")
		.data;
}
