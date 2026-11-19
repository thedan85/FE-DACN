import { z } from "zod";

// Identifiers/codes are structural strings, never inferred from display data.
// Timestamps stay plain strings (the API can include nanosecond precision).
export const PermissionSchema = z.object({
	permissionId: z.string(),
	code: z.string(),
	name: z.string().nullable(),
	resource: z.string().nullable(),
	action: z.string().nullable(),
	description: z.string().nullable(),
	createdAt: z.string().nullable(),
	updatedAt: z.string().nullable(),
});

export const RoleSummarySchema = z.object({
	roleId: z.string(),
	code: z.string(),
	name: z.string().nullable(),
	description: z.string().nullable(),
	system: z.boolean(),
	createdAt: z.string().nullable(),
	updatedAt: z.string().nullable(),
});

export const RoleDetailSchema = RoleSummarySchema.extend({
	permissions: z.array(PermissionSchema),
});

export type Permission = z.infer<typeof PermissionSchema>;
export type RoleSummary = z.infer<typeof RoleSummarySchema>;
export type RoleDetail = z.infer<typeof RoleDetailSchema>;
