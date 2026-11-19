import { z } from "zod";

/**
 * Admin Role DTOs, mirrored from the backend `docs/admin-roles-api.md`.
 * `roleId`/`permissionId` are opaque business IDs — never derive them from
 * codes. `GET /admin/roles/{roleId}` returns grants sorted by permission
 * code; `code` is lowercase and immutable; `description` is nullable.
 */

export const AdminPermissionSchema = z.object({
	permissionId: z.string(),
	code: z.string(),
	name: z.string(),
	resource: z.string(),
	action: z.string(),
	description: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const AdminRoleSummarySchema = z.object({
	roleId: z.string(),
	code: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	system: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const AdminRoleDetailSchema = AdminRoleSummarySchema.extend({
	permissions: z.array(AdminPermissionSchema),
});

export type AdminPermission = z.infer<typeof AdminPermissionSchema>;
export type AdminRoleSummary = z.infer<typeof AdminRoleSummarySchema>;
export type AdminRoleDetail = z.infer<typeof AdminRoleDetailSchema>;
