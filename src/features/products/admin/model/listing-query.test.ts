import { expect, it } from "vitest";

import {
	DEFAULT_LISTING_QUERY,
	parseListingQuery,
	toListingHref,
	toListingSearchParams,
} from "./listing-query";

/**
 * The listing's URL state. This is the only place filter values become safe to
 * send: the backend answers 400 for an unknown `status` or `sort`, and it
 * silently drops a misspelled parameter, so raw URL input must never reach it.
 */

it("defaults to the first page of Active products", () => {
	// Omitting `status` on the wire means ACTIVE, but the value is still sent
	// explicitly so the UI can show which filter is applied.
	expect(parseListingQuery({})).toEqual(DEFAULT_LISTING_QUERY);
	expect(DEFAULT_LISTING_QUERY).toMatchObject({
		status: "ACTIVE",
		sort: "NEWEST",
		page: 1,
	});
});

it("accepts each backend status as a filter", () => {
	expect(parseListingQuery({ status: "DRAFT" }).status).toBe("DRAFT");
	expect(parseListingQuery({ status: "ACTIVE" }).status).toBe("ACTIVE");
	expect(parseListingQuery({ status: "INACTIVE" }).status).toBe("INACTIVE");
	expect(parseListingQuery({ status: "DELETED" }).status).toBe("DELETED");
});

it("normalises case, then falls back for a status that is not a status", () => {
	// The API's own converter is case-insensitive in spirit (its sort converter
	// upper-cases), so an all-lowercase URL is accepted rather than treated as a
	// typo. What must not happen is an unknown word reaching the API, where it
	// is a 400.
	expect(parseListingQuery({ status: "inactive" }).status).toBe("INACTIVE");
	expect(parseListingQuery({ status: "draft" }).status).toBe("DRAFT");
	expect(parseListingQuery({ status: "ARCHIVED" }).status).toBe("ACTIVE");
	expect(parseListingQuery({ status: "nonsense" }).status).toBe("ACTIVE");
	expect(parseListingQuery({ status: "" }).status).toBe("ACTIVE");
});

it("accepts the three server-side sorts in either spelling", () => {
	expect(parseListingQuery({ sort: "PRICE_ASC" }).sort).toBe("PRICE_ASC");
	expect(parseListingQuery({ sort: "PRICE_DESC" }).sort).toBe("PRICE_DESC");
	// The API spells these lowercase in its docs and upper-cases them on the way
	// in (`ProductSortConverter`), so both forms are the same request.
	expect(parseListingQuery({ sort: "price_asc" }).sort).toBe("PRICE_ASC");
	expect(parseListingQuery({ sort: "newest" }).sort).toBe("NEWEST");
	// A Spring-style `sort=field,dir` is a different parameter the backend
	// discards; it must not be mistaken for ours.
	expect(parseListingQuery({ sort: "createdAt,desc" }).sort).toBe("NEWEST");
	expect(parseListingQuery({ sort: "bogus" }).sort).toBe("NEWEST");
});

it("clamps the page to a sane 1-based number", () => {
	// The URL is 1-based and user-editable; the API is 0-based and would accept
	// a negative index silently.
	expect(parseListingQuery({ page: "3" }).page).toBe(3);
	expect(parseListingQuery({ page: "0" }).page).toBe(1);
	expect(parseListingQuery({ page: "-2" }).page).toBe(1);
	expect(parseListingQuery({ page: "abc" }).page).toBe(1);
	expect(parseListingQuery({ page: "1.5" }).page).toBe(1);
});

it("keeps a trimmed keyword and drops a blank one", () => {
	expect(parseListingQuery({ keyword: "  anubias  " }).keyword).toBe("anubias");
	expect(parseListingQuery({ keyword: "   " }).keyword).toBeUndefined();
	expect(parseListingQuery({ keyword: "a".repeat(200) }).keyword).toBeUndefined();
});

it("takes the first value when a parameter is repeated", () => {
	// Next hands a repeated param over as an array; passing the array straight to
	// the API would serialise as "a,b".
	expect(
		parseListingQuery({ keyword: ["anubias", "tetra"], status: "DRAFT" })
			.keyword,
	).toBe("anubias");
});

it("writes only non-default values back to the URL", () => {
	// Keeping the default out of the URL makes /admin/products the canonical
	// form, so a filtered view is visibly different from the plain one.
	expect(toListingSearchParams(DEFAULT_LISTING_QUERY)).toEqual({});

	expect(
		toListingSearchParams({
			keyword: "anubias",
			status: "DRAFT",
			category: "epiphyte",
			sort: "PRICE_DESC",
			page: 2,
		}),
	).toEqual({
		keyword: "anubias",
		status: "DRAFT",
		category: "epiphyte",
		sort: "PRICE_DESC",
		page: "2",
	});
});

it("round-trips through a URL", () => {
	const query = {
		keyword: "anubias",
		status: "DRAFT" as const,
		category: "epiphyte",
		sort: "PRICE_ASC" as const,
		page: 3,
	};

	expect(parseListingQuery(toListingSearchParams(query))).toEqual(query);
});

it("builds the bare path when nothing is filtered", () => {
	expect(toListingHref(DEFAULT_LISTING_QUERY)).toBe("/admin/products");
	expect(toListingHref({ ...DEFAULT_LISTING_QUERY, status: "DRAFT" })).toBe(
		"/admin/products?status=DRAFT",
	);
});
