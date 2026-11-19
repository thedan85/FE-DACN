import { z } from "zod";

/**
 * Admin User DTOs, mirrored from the backend `docs/admin-users-api.md`.
 * Role codes are lowercase; statuses are `ACTIVE | LOCKED`; soft-deleted users
 * are never returned. `phone`/`address`/`lastLogin` are nullable — a
 * Google-linked customer or a never-signed-in staff account carries nulls, not
 * empty strings.
 */

export const AdminUserStatusSchema = z.enum(["ACTIVE", "LOCKED"]);

export const AdminUserSchema = z.object({
	userId: z.string(),
	email: z.string(),
	name: z.string(),
	phone: z.string().nullable(),
	roleCode: z.string(),
	roleName: z.string(),
	status: AdminUserStatusSchema,
	lastLogin: z.string().nullable(),
	createdAt: z.string(),
});

export const AdminUserDetailSchema = AdminUserSchema.extend({
	address: z.string().nullable(),
	permissions: z.array(z.string()),
});

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
