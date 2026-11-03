import { expect, it } from "vitest";

import { CATALOG_PERMISSIONS, hasCatalogPermission } from "./permissions";

/**
 * Permission codes and the check against them.
 *
 * The backend owns enforcement (`@PreAuthorize` plus `SecurityConfig` URL
 * rules); these constants exist so the UI hides actions that would only earn
 * the user a 403, and so a typo in a permission string is a type error rather
 * than a silently-always-false gate.
 */

it("mirrors the backend's permission codes exactly", () => {
	// `Permissions.java` in the backend repo — a mismatch here means a control
	// that never appears, with nothing failing to say so.
	expect(CATALOG_PERMISSIONS).toEqual({
		productCreate: "product:create",
		productUpdate: "product:update",
		productDelete: "product:delete",
		variantCreate: "variant:create",
		variantUpdate: "variant:update",
		variantDelete: "variant:delete",
		attributeCreate: "attribute:create",
		attributeDelete: "attribute:delete",
		mediaCreate: "media:create",
	});
});

it("grants a permission the account holds", () => {
	const held = ["product:read", "product:create", "order:read"];

	expect(hasCatalogPermission(held, "product:create")).toBe(true);
});

it("denies a permission the account lacks", () => {
	// The dev customer holds only the read permissions.
	const held = ["product:read", "category:read", "variant:read"];

	expect(hasCatalogPermission(held, "product:create")).toBe(false);
	expect(hasCatalogPermission(held, "product:delete")).toBe(false);
});

it("denies everything when there is no account", () => {
	expect(hasCatalogPermission(null, "product:create")).toBe(false);
	expect(hasCatalogPermission(undefined, "product:delete")).toBe(false);
});

it("does not treat a prefix as a grant", () => {
	// A substring or prefix check would let a longer code imply a shorter one,
	// and vice versa. The backend's `hasAuthority` compares whole strings, so
	// a held superstring must not satisfy a shorter request.
	expect(hasCatalogPermission(["product:create"], "product:update")).toBe(
		false,
	);
	expect(hasCatalogPermission(["product:create"], "product:delete")).toBe(
		false,
	);
	expect(
		hasCatalogPermission(["product:create:extra"], "product:create"),
	).toBe(false);
	expect(hasCatalogPermission(["prod"], "product:create")).toBe(false);
});
