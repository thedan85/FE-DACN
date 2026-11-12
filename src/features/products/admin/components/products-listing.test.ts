import { describe, expect, it } from "vitest";

import { productStatusLabel, productStatusTone } from "../model/product-status";
import { buildProductRow } from "../model/product-row";
import { parseListingQuery, toApiPage, toListingSearchParams } from "../model/listing-query";
import type { Product } from "../../types";

/**
 * The listing's behaviour that can be checked without a browser.
 *
 * These are deliberately about *what the user sees* — the label a status
 * renders, the cell a row produces, the query a URL becomes — rather than
 * about component internals, which a refactor should be free to change.
 */

const anubias: Product = {
	productId: "PRD_194",
	slug: "anubias-nana-petite",
	name: "Anubias Nana Petite",
	description: "",
	detailDescription: "",
	thumbnail: "https://res.cloudinary.com/x/a.webp",
	thumbnailMediaId: "MED_a",
	status: "ACTIVE",
	categoryId: "epiphyte",
	categoryName: "Epiphyte",
	minPrice: 120000,
	maxPrice: 120000,
	stock: 50,
	createdAt: "2026-11-01T17:10:51.205759Z",
	updatedAt: "2026-11-01T17:10:51.205759Z",
};

describe("the listing renders the vocabulary the design specifies", () => {
	it("pairs each backend status with the design's label and tone", () => {
		// The four pills the table can show. `INACTIVE` must never surface as
		// "Inactive" — GLOSSARY.md lists that word under _Avoid_.
		expect([
			productStatusLabel("ACTIVE"),
			productStatusLabel("DRAFT"),
			productStatusLabel("INACTIVE"),
			productStatusLabel("DELETED"),
		]).toEqual(["Active", "Draft", "Archived", "Deleted"]);

		expect(productStatusTone("ACTIVE")).toBe("success");
		expect(productStatusTone("DRAFT")).toBe("warning");
		expect(productStatusTone("INACTIVE")).toBe("danger");
	});
});

describe("the product cell", () => {
	it("omits the SKU and variant count until the row's detail loads", () => {
		// Both fields live only on the detail aggregate. Rendering 0 or "" would
		// state something the list response never said.
		const row = buildProductRow(anubias);

		expect(row.firstVariantSku).toBeNull();
		expect(row.variantCount).toBeNull();
		expect(row.name).toBe("Anubias Nana Petite");
		expect(row.priceRange).not.toBeNull();
	});
});

describe("the URL is the listing's state", () => {
	it("sends a status the API accepts and never a blank one", () => {
		expect(parseListingQuery({}).status).toBe("ACTIVE");
		expect(parseListingQuery({ status: "DRAFT" }).status).toBe("DRAFT");
	});

	it("converts the 1-based URL page to the API's 0-based index", () => {
		// Getting this wrong silently skips page one, which looks like a filter bug.
		expect(toApiPage(1)).toBe(0);
		expect(toApiPage(2)).toBe(1);
		expect(toApiPage(0)).toBe(0);
		expect(toApiPage(-5)).toBe(0);
	});

	it("keeps the default view on the bare path", () => {
		expect(toListingSearchParams(parseListingQuery({}))).toEqual({});
	});

	it("round-trips a filtered view", () => {
		const query = parseListingQuery({
			keyword: "anubias",
			status: "DELETED",
			category: "epiphyte",
			sort: "PRICE_DESC",
			page: "3",
		});

		expect(parseListingQuery(toListingSearchParams(query))).toEqual(query);
	});
});
