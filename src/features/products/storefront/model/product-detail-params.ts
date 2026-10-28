/**
 * Route-input validation for `/products/[slug]` — untrusted path segment.
 *
 * The backend only ever stores slugs matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`
 * (see `ProductService.normalizeExplicitSlug`, max 255 chars) and looks them
 * up case-insensitively (verified live: `GET /products/CONGO-TETRA` → 200).
 *
 * Rejecting an impossible slug here means the page can call `notFound()`
 * **without issuing a request** — malformed input never reaches the API.
 * Validation is deliberately no stricter than the backend's own rule so a
 * legitimate slug can never be turned into a false 404.
 */

/** Mirrors `ProductService.MAX_SLUG_LENGTH`. */
const MAX_SLUG_LENGTH = 255;

/** Mirrors `ProductService.SLUG_PATTERN`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Returns the canonical product slug (trimmed + lowercased, so equivalent
 * casings share one cache entry), or `null` when the segment cannot name a
 * product and the page should render the not-found state.
 */
export function parseProductSlug(raw: string | undefined | null): string | null {
	if (typeof raw !== "string") {
		return null;
	}

	const slug = raw.trim().toLowerCase();

	if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
		return null;
	}

	return slug;
}
