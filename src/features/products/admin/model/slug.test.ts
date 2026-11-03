import { expect, it } from "vitest";

import { deriveSlug, normalizeSlug, validateSlug } from "./slug";

/**
 * The slug rules are the backend's, not ours: `ProductService.SLUG_PATTERN`,
 * `RESERVED_SLUGS` and a 255-char ceiling, with `BusinessId.slug` deriving the
 * value when the field is left blank. `deriveSlug` mirrors that derivation so
 * the URL previewed in the form is the one the product will actually get.
 */

it("derives the same slug the backend derives from a name", () => {
	expect(deriveSlug("Blue Dream Shrimp")).toBe("blue-dream-shrimp");
	expect(deriveSlug("  Neon   Tetra  ")).toBe("neon-tetra");
	expect(deriveSlug("CO₂ Starter Kit")).toBe("co-starter-kit");
});

it("strips diacritics and maps đ before slugifying", () => {
	// `BusinessId.slug` normalises NFD, drops combining marks and maps đ→d, so a
	// Vietnamese product name must not lose its letters on the way to a URL.
	expect(deriveSlug("Cá Betta Đỏ")).toBe("ca-betta-do");
	expect(deriveSlug("Anubias Nana 'Petite'")).toBe("anubias-nana-petite");
});

it("never returns a blank slug", () => {
	// The backend substitutes "unnamed" for an empty result; a preview that said
	// "" would promise a URL that cannot exist.
	expect(deriveSlug("!!!")).toBe("unnamed");
	expect(deriveSlug("")).toBe("unnamed");
});

it("accepts a well-formed slug", () => {
	expect(validateSlug("blue-dream-shrimp")).toBeNull();
	expect(validateSlug("a1")).toBeNull();
});

it("accepts a blank slug, because blank means 'derive it from the name'", () => {
	expect(validateSlug("")).toBeNull();
	expect(validateSlug("   ")).toBeNull();
});

it("rejects a slug the backend would answer 400 for", () => {
	// `normalizeExplicitSlug` lowercases first, so mixed case is *accepted* by
	// the server (and stored lowercased) — see the next test. What it rejects is
	// a shape the pattern cannot match, or a reserved word.
	expect(validateSlug("a--b")).not.toBeNull();
	expect(validateSlug("-leading")).not.toBeNull();
	expect(validateSlug("trailing-")).not.toBeNull();
	expect(validateSlug("has space")).not.toBeNull();
	expect(validateSlug("search")).not.toBeNull();
	expect(validateSlug("under_score")).not.toBeNull();
});

it("accepts mixed case, because the backend lowercases before matching", () => {
	// `ProductService.normalizeExplicitSlug` does `strip().toLowerCase()` and
	// *then* pattern-matches, so "Blue-Dream" is a 200, not a 400. Rejecting it
	// here would block a value the API accepts.
	expect(validateSlug("Blue-Dream")).toBeNull();
	expect(normalizeSlug("  Blue-Dream  ")).toBe("blue-dream");
	// Reserved words are reserved after normalisation, not before.
	expect(validateSlug("Search")).not.toBeNull();
});

it("rejects a slug longer than the column allows", () => {
	expect(validateSlug("a".repeat(255))).toBeNull();
	expect(validateSlug("a".repeat(256))).not.toBeNull();
});
