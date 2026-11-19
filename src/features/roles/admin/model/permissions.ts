export const ROLE_PERMISSIONS = {
	read: "role:read", create: "role:create", update: "role:update", delete: "role:delete",
} as const;
export type RolePermission = (typeof ROLE_PERMISSIONS)[keyof typeof ROLE_PERMISSIONS];

export function hasRolePermission(permissions: readonly string[] | null | undefined, permission: RolePermission) {
	return permissions?.includes(permission) ?? false;
}
