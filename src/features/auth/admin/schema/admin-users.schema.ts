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

export const CreateAdminUserRequestSchema = z.object({
	email: z.string(),
	password: z.string(),
	name: z.string(),
	phone: z.string(),
	address: z.string().optional(),
	roleCode: z.string(),
});

export type AdminUserStatus = z.infer<typeof AdminUserStatusSchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;
export type AdminUserCreateInput = z.infer<typeof CreateAdminUserRequestSchema>;
