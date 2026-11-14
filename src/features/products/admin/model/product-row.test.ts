import { expect, it } from "vitest";

import { formatPriceRange } from "../../storefront/model/product-format";
import type { Product, ProductDetail } from "../../types";
import { buildProductRow } from "./product-row";

/**
 * The listing row the design shows has a **Variant count** column, but
 * `ProductResponse` carries no variant count — only the detail aggregate
 * returns `variants[]`. The row therefore knows its count and its SKU only once
 * that product's detail has been fetched, and says so with `null` rather than
 * showing a guess.
 */

/** The live backend's shape for a single-variant product (PRD_194). */
const anubias: Product = {
	productId: "PRD_194",
	slug: "anubias-nana-petite",
	name: "Anubias Nana Petite",
	description: "The smallest common anubias.",
	detailDescription: "",
	thumbnail: "https://res.cloudinary.com/x/anubias.webp",
	thumbnailMediaId: "MED_anubias-nana-petite",
	status: "ACTIVE",
	categoryId: "epiphyte",
	categoryName: "Epiphyte",
	minPrice: 120000,
	maxPrice: 120000,
	stock: 50,
	createdAt: "2026-11-01T17:10:51.205759Z",
	updatedAt: "2026-11-01T17:10:51.205759Z",
};

/** `PRD_172`, whose two variants range 15000–18000. */
const penguin: Product = {
	...anubias,
	productId: "PRD_172",
	slug: "penguin-tetra",
	name: "Penguin Tetra",
	minPrice: 15000,
	maxPrice: 18000,
	stock: 100,
};

function detailOf(product: Product, skus: string[]): ProductDetail {
	return {
		product,
		attributes: [],
		variants: skus.map((sku, index) => ({
			variantId: `${product.slug}-${index}`,
			sku,
			price: 15000,
			stock: 50,
			stockRevision: 0,
			attributes: [],
			media: [],
		})),
		reviews: {
			content: [],
			page: 0,
			size: 20,
			totalElements: 0,
			totalPages: 0,
		},
	};
}

it("projects the columns the list response can fill, before any detail loads", () => {
	const row = buildProductRow(anubias);

	expect(row).toMatchObject({
		productId: "PRD_194",
		slug: "anubias-nana-petite",
		name: "Anubias Nana Petite",
		thumbnail: "https://res.cloudinary.com/x/anubias.webp",
		categoryName: "Epiphyte",
		status: "ACTIVE",
		stock: 50,
	});
	// Unknown until the detail request lands — not zero, which would be a claim.
	expect(row.firstVariantSku).toBeNull();
	expect(row.variantCount).toBeNull();
});

it("fills the SKU and count from the detail aggregate once it arrives", () => {
	const row = buildProductRow(
		penguin,
		detailOf(penguin, ["FISH-PENGUIN-TETRA", "FISH-PENGUIN-TETRA-RED-TAIL"]),
	);

	// The backend sorts the default variant first, so variants[0] is the one the
	// design's single SKU slot should show.
	expect(row.firstVariantSku).toBe("FISH-PENGUIN-TETRA");
	expect(row.variantCount).toBe(2);
});

it("formats the price range from the variant prices, not from a base price", () => {
	// There is no product-level price on the backend: min/max are derived from
	// the variants, and a single-variant product collapses to one figure. The
	// expected strings come from the existing formatter rather than a
	// re-implementation, so a change to VND formatting cannot leave this test
	// agreeing with a broken helper.
	expect(buildProductRow(penguin).priceRange).toBe(
		formatPriceRange(15000, 18000),
	);
	expect(buildProductRow(anubias).priceRange).toBe(
		formatPriceRange(120000, 120000),
	);
	// Sanity-check the helper itself did something recognisable, so the
	// assertions above cannot both pass on a formatter that returns null.
	expect(buildProductRow(anubias).priceRange).not.toBeNull();
});

it("reports a missing price instead of rendering zero", () => {
	// A product with no variants answers null/null; a row must not claim it
	// costs nothing.
	const priceless = { ...anubias, minPrice: null, maxPrice: null, stock: 0 };

	expect(buildProductRow(priceless).priceRange).toBeNull();
});

it("keeps a product with no category readable", () => {
	const uncategorised = { ...anubias, categoryId: null, categoryName: null };

	expect(buildProductRow(uncategorised).categoryName).toBeNull();
});

it("tolerates a null stock from the cached list overlay", () => {
	const cached = { ...anubias, stock: null };

	expect(buildProductRow(cached).stock).toBe(0);
});
