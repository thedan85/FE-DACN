import { expect, it } from "vitest";

import type { Product } from "../../types";
import {
	buildProductPatch,
	buildProductRequest,
	hasProductChanges,
	toProductFormValues,
} from "./product-edit";

/**
 * The edit form's two jobs: prefill from the product, and send only what the
 * user actually changed — with the *right method*.
 *
 * The method is not cosmetic. `PATCH` merges, so a null category is a no-op
 * there; only `PUT` detaches, and `PUT` also clears the thumbnail when it is
 * omitted. Both facts are backend behaviour (`ProductService.update` /
 * `replace`), so getting either wrong silently loses or ignores data.
 */

const anubias: Product = {
	productId: "PRD_194",
	slug: "anubias-nana-petite",
	name: "Anubias Nana Petite",
	description: "The smallest common anubias.",
	detailDescription: "Care guide line one.",
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

it("prefills every editable field from the product", () => {
	expect(toProductFormValues(anubias)).toEqual({
		name: "Anubias Nana Petite",
		description: "The smallest common anubias.",
		detailDescription: "Care guide line one.",
		categoryId: "epiphyte",
		slug: "anubias-nana-petite",
		status: "ACTIVE",
	});
});

it("reports no changes when nothing was edited", () => {
	const values = toProductFormValues(anubias);

	expect(hasProductChanges(values, anubias)).toBe(false);
	expect(buildProductPatch(values, anubias)).toEqual({});
	expect(buildProductRequest(values, anubias)).toBeNull();
});

it("sends only the fields that differ", () => {
	const values = { ...toProductFormValues(anubias), name: "Renamed" };
	const request = buildProductRequest(values, anubias);

	expect(request).toEqual({ method: "PATCH", body: { name: "Renamed" } });
});

it("ignores whitespace-only differences in text fields", () => {
	const values = {
		...toProductFormValues(anubias),
		name: "  Anubias Nana Petite  ",
	};

	expect(buildProductPatch(values, anubias)).toEqual({});
});

it("does not resend the slug when it is unchanged", () => {
	const values = { ...toProductFormValues(anubias), description: "New copy." };

	expect(buildProductPatch(values, anubias)).toEqual({
		description: "New copy.",
	});
});

it("sends a changed slug", () => {
	const values = { ...toProductFormValues(anubias), slug: "anubias-petite" };

	expect(buildProductPatch(values, anubias)).toEqual({
		slug: "anubias-petite",
	});
});

it("uses PUT to detach a category, because PATCH ignores a null", () => {
	// `ProductService.update` assigns a category only when one is supplied, so a
	// PATCH with `categoryId: null` leaves the old category attached forever.
	const values = { ...toProductFormValues(anubias), categoryId: undefined };
	const request = buildProductRequest(values, anubias);

	expect(request?.method).toBe("PUT");
	expect(request?.body.categoryId).toBeNull();
});

it("keeps the thumbnail when a replace detaches the category", () => {
	// A PUT that omits `thumbnailMediaId` clears the thumbnail; detaching a
	// category must not silently delete the product's image.
	const values = { ...toProductFormValues(anubias), categoryId: undefined };
	const request = buildProductRequest(values, anubias);

	expect(request?.body.thumbnailMediaId).toBe("MED_a");
});

it("carries the full current state in a replace", () => {
	const values = {
		...toProductFormValues(anubias),
		name: "Renamed",
		categoryId: undefined,
	};
	const request = buildProductRequest(values, anubias);

	expect(request?.body).toMatchObject({
		name: "Renamed",
		description: "The smallest common anubias.",
		detailDescription: "Care guide line one.",
		categoryId: null,
		slug: "anubias-nana-petite",
		status: "ACTIVE",
	});
});

it("detects a status-only change and sends it by PATCH", () => {
	// Archiving is exactly this: one field, merge semantics (ADR-0002).
	const values = { ...toProductFormValues(anubias), status: "INACTIVE" as const };

	expect(hasProductChanges(values, anubias)).toBe(true);
	expect(buildProductRequest(values, anubias)).toEqual({
		method: "PATCH",
		body: { status: "INACTIVE" },
	});
});

it("treats a cleared optional description as an empty string", () => {
	const values = { ...toProductFormValues(anubias), detailDescription: "" };

	expect(buildProductPatch(values, anubias)).toEqual({
		detailDescription: "",
	});
});

it("does not mark a deleted product dirty just by opening it", () => {
	// A DELETED row opens as Archived (the only assignable status). Comparing it
	// against DELETED would mark the form dirty on load and offer to PATCH
	// INACTIVE onto a deleted product.
	const deleted: Product = { ...anubias, status: "DELETED" };
	const values = toProductFormValues(deleted);

	expect(values.status).toBe("INACTIVE");
	expect(hasProductChanges(values, deleted)).toBe(false);
});

it("still writes when a deleted product's status is changed away from Archived", () => {
	const deleted: Product = { ...anubias, status: "DELETED" };
	const values = { ...toProductFormValues(deleted), status: "ACTIVE" as const };

	expect(buildProductRequest(values, deleted)).toEqual({
		method: "PATCH",
		body: { status: "ACTIVE" },
	});
});
