import { z } from "zod";

import {
	UserAccountStatusSchema,
	UserDetailSchema,
	UserSummarySchema,
} from "@/features/users/admin/schema/user.schema";

/**
 * Admin User DTOs, mirrored from the backend `docs/admin-users-api.md`.
 * Role codes are lowercase; statuses are `ACTIVE | LOCKED`; soft-deleted users
 * are never returned. `name` can be missing when the current-role profile row
 * is absent, and `phone`/`address`/`lastLogin` are nullable — the directory
 * reads through a left join. The canonical Users schemas own that shape so the
 * two screens cannot drift.
 */

export const AdminUserStatusSchema = UserAccountStatusSchema;

export const AdminUserSchema = UserSummarySchema;

export const AdminUserDetailSchema = UserDetailSchema;

export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

/**
 * Partial customer-profile update sent to `PATCH /admin/users/{userId}/profile`.
 * Omitted fields are unchanged; `address: null` clears the stored address.
 * `phone` cannot be cleared — an explicit `null` is rejected with 400.
 */
export type CustomerProfilePatch = {
	name?: string;
	phone?: string;
	address?: string | null;
};
