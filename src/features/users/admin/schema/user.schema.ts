import { z } from "zod";

import { createPageResponseSchema } from "@/lib/api/schema";

/**
 * The admin user API's response shapes, mirrored from `docs/admin-users-api.md`.
 *
 * `status` is narrowed to the two values the user endpoints actually return:
 * soft-deleted users are excluded from every read, so `DELETED` never reaches a
 * screen. Keeping it out of the schema makes an accidental `DELETED` row a
 * contract failure rather than a status pill with no design.
 */

export const UserAccountStatusSchema = z.enum(["ACTIVE", "LOCKED"]);

export const UserSummarySchema = z.object({
	userId: z.string(),
	email: z.string(),
	// The current-role profile can be absent, even while the account exists.
	name: z.string().nullable(),
	phone: z.string().nullable(),
	roleCode: z.string(),
	roleName: z.string(),
	status: UserAccountStatusSchema,
	lastLogin: z.string().nullable(),
	createdAt: z.string(),
});

export const UserDetailSchema = UserSummarySchema.extend({
	address: z.string().nullable(),
	permissions: z.array(z.string()),
});

export const UserPageSchema = createPageResponseSchema(UserSummarySchema);

/**
 * `GET admin/roles` returns a plain array of these. Only the fields the user
 * screens render are declared; Zod ignores the rest of the row.
 */
export const RoleSchema = z.object({
	roleId: z.string(),
	code: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	system: z.boolean(),
});

export type UserAccountStatus = z.infer<typeof UserAccountStatusSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type UserDetail = z.infer<typeof UserDetailSchema>;
export type UserPage = z.infer<typeof UserPageSchema>;
export type Role = z.infer<typeof RoleSchema>;
