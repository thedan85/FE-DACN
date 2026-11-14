/**
 * The order permission codes this feature gates on.
 *
 * Mirrored from `Permissions.java` in the backend repo. The backend enforces
 * them twice (`@PreAuthorize` on the controller method and the URL rules in
 * `SecurityConfig`); the frontend only *reflects* them, hiding actions that
 * would otherwise fail with a 403. Never treat these as security: a hidden
 * button is a courtesy, and the server does not consult it.
 */
export const ORDER_PERMISSIONS = {
	read: "order:read",
	update: "order:update",
} as const;

/** A permission this feature knows how to check. */
export type OrderPermission =
	(typeof ORDER_PERMISSIONS)[keyof typeof ORDER_PERMISSIONS];

/**
 * Exact-match permission check — the same comparison the backend's
 * `Permissions.has` performs on the authority list.
 *
 * Equality rather than a prefix or substring match: `order:read` must not
 * imply anything it is not, and the codes are not hierarchical.
 */
export function hasOrderPermission(
	permissions: readonly string[] | null | undefined,
	permission: OrderPermission,
): boolean {
	return permissions != null && permissions.includes(permission);
}
