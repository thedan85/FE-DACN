/**
 * The user-account permission codes this feature gates on.
 *
 * Mirrored from `Permissions.java` in the backend repo. The backend enforces
 * them twice (`@PreAuthorize` on the controller method and the URL rules in
 * `SecurityConfig`); the frontend only *reflects* them, hiding actions that
 * would otherwise fail with a 403. Never treat these as security: a hidden
 * button is a courtesy, and the server does not consult it.
 */
export const USER_PERMISSIONS = {
	read: "user:read",
	create: "user:create",
	update: "user:update",
	delete: "user:delete",
} as const;

/** A permission this feature knows how to check. */
export type UserPermission =
	(typeof USER_PERMISSIONS)[keyof typeof USER_PERMISSIONS];

/**
 * Exact-match permission check — the same comparison the backend's
 * `Permissions.has` performs on the authority list. The codes are not
 * hierarchical, so `user:update` must not imply `user:delete`.
 */
export function hasUserPermission(
	permissions: readonly string[] | null | undefined,
	permission: UserPermission,
): boolean {
	return permissions != null && permissions.includes(permission);
}
