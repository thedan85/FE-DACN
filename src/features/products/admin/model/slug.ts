/**
 * Slug rules, mirrored from the backend so the form rejects what the API would
 * reject instead of discovering it at save time.
 *
 * Source of truth: `ProductService` in the backend repo —
 * `SLUG_PATTERN = ^[a-z0-9]+(?:-[a-z0-9]+)*$`, `RESERVED_SLUGS = {search}`,
 * `MAX_SLUG_LENGTH = 255` — plus `BusinessId.slug` for the derivation used when
 * the field is left blank.
 */

/** `ProductService.MAX_SLUG_LENGTH`. */
const MAX_SLUG_LENGTH = 255;

/** `ProductService.SLUG_PATTERN`, unanchored flags included deliberately. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Literal paths under `/api/v1/products` that would shadow a product route if
 * used as a slug, so the backend refuses them (a product named "Search"
 * becomes "search-2").
 */
const RESERVED_SLUGS = new Set(["search"]);

/**
 * Derives a slug from a product name the way the backend does when no slug is
 * supplied (`BusinessId.slug`): normalise NFD, drop combining marks, lowercase,
 * map `đ` → `d`, collapse everything else to single dashes, trim dashes.
 *
 * This is a *preview* of what the server will do, not a guarantee: the backend
 * also appends `-2`, `-3`, … on collision, which the client cannot predict
 * without querying every existing slug. The created product's real slug is
 * whatever the API response says.
 */
export function deriveSlug(name: string): string {
	const ascii = name
		.normalize("NFD")
		.replace(/\p{M}+/gu, "")
		.toLowerCase()
		.replace(/đ/g, "d");

	const slug = ascii.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

	return slug === "" ? "unnamed" : slug;
}

/**
 * Normalises a typed slug the way the backend does before validating it
 * (`ProductService.normalizeExplicitSlug` — strip, then lowercase, then match).
 *
 * The lowercasing matters: the API accepts `Blue-Dream` and stores
 * `blue-dream`, so a validator that rejected mixed case would be stricter than
 * the server and would block a value the backend is happy with.
 */
export function normalizeSlug(value: string): string {
	return value.trim().toLowerCase();
}

/**
 * Validates a slug the user typed, returning a message on rejection and `null`
 * when acceptable — the shape an antd `Form` validator wants.
 *
 * A blank value is accepted: on create it means "derive it from the name", and
 * on edit it means "leave the slug alone", which is how the backend reads both
 * (`resolveCreateSlug` and `applySlugChange` both no-op on blank).
 *
 * Validation runs against the normalised value, so this rejects exactly what
 * the backend rejects — no more, and no less. A leading or trailing dash cannot
 * survive `deriveSlug`, but it can be typed, so the pattern still applies.
 */
export function validateSlug(value: string): string | null {
	const slug = normalizeSlug(value);

	if (slug === "") {
		return null;
	}

	if (slug.length > MAX_SLUG_LENGTH) {
		return `Use at most ${MAX_SLUG_LENGTH} characters.`;
	}

	if (!SLUG_PATTERN.test(slug)) {
		return "Use lowercase letters, numbers and single dashes only (for example: blue-dream-shrimp).";
	}

	if (RESERVED_SLUGS.has(slug)) {
		return "That slug is reserved. Choose another one.";
	}

	return null;
}
