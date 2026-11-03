/**
 * The catalog permission codes this feature gates on.
 *
 * Mirrored from `Permissions.java` in the backend repo. The backend enforces
 * them twice (`@PreAuthorize` on the controller method and the URL rules in
 * `SecurityConfig`); the frontend only *reflects* them, hiding actions that
 * would otherwise fail with a 403. Never treat these as security: a hidden
 * button is a courtesy, and the server does not consult it.
 */
export const CATALOG_PERMISSIONS = {
	productCreate: "product:create",
	productUpdate: "product:update",
	productDelete: "product:delete",
	variantCreate: "variant:create",
	variantUpdate: "variant:update",
	variantDelete: "variant:delete",
	attributeCreate: "attribute:create",
	attributeDelete: "attribute:delete",
	mediaCreate: "media:create",
} as const;

/** A permission this feature knows how to check. */
export type CatalogPermission =
	(typeof CATALOG_PERMISSIONS)[keyof typeof CATALOG_PERMISSIONS];

/**
 * Exact-match permission check — the same comparison the backend's
 * `Permissions.has` performs on the authority list.
 *
 * Equality rather than a prefix or substring match: `product:create` must not
 * imply anything it is not, and the codes are not hierarchical.
 */
export function hasCatalogPermission(
	permissions: readonly string[] | null | undefined,
	permission: CatalogPermission,
): boolean {
	return permissions != null && permissions.includes(permission);
}
