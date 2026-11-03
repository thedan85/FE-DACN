import { expect, it } from "vitest";

import type { Category } from "../../types";
import {
	categoryOptions,
	toProductCreateInput,
	validateProductForm,
} from "./product-form";

/**
 * The create form's rules, independent of the component that renders them.
 *
 * The backend is the authority (`ProductCreateRequest`: name `@NotBlank` and
 * ≤255, description `@NotBlank`), so anything the client rejects must be
 * something the API would reject too — a client that is stricter than the API
 * blocks valid work, and one that is looser wastes a round trip.
 */

const categories: Category[] = [
	{
		categoryId: "livestock",
		name: "Livestock",
		slug: "livestock",
		parentCategoryId: null,
		deleted: false,
		createdAt: "",
		updatedAt: "",
	},
	{
		categoryId: "freshwater-fish",
		name: "Freshwater fish",
		slug: "freshwater-fish",
		parentCategoryId: "livestock",
		deleted: false,
		createdAt: "",
		updatedAt: "",
	},
];

it("accepts a name and description, the two fields the API requires", () => {
	expect(
		validateProductForm({ name: "Blue Dream Shrimp", description: "Hardy shrimp." }),
	).toEqual({});
});

it("rejects a blank or whitespace-only name", () => {
	// `@NotBlank` on the backend: whitespace is blank, not a value.
	expect(validateProductForm({ name: "", description: "x" }).name).toBeDefined();
	expect(validateProductForm({ name: "   ", description: "x" }).name).toBeDefined();
});

it("rejects a blank description, which the API also requires", () => {
	expect(
		validateProductForm({ name: "x", description: "" }).description,
	).toBeDefined();
});

it("rejects a name longer than the column allows", () => {
	// `@Size(max = 255)` on ProductCreateRequest.name.
	expect(
		validateProductForm({ name: "a".repeat(255), description: "x" }).name,
	).toBeUndefined();
	expect(
		validateProductForm({ name: "a".repeat(256), description: "x" }).name,
	).toBeDefined();
});

it("rejects a slug the backend would answer 400 for", () => {
	expect(
		validateProductForm({ name: "x", description: "y", slug: "Bad Slug" }).slug,
	).toBeDefined();
	expect(
		validateProductForm({ name: "x", description: "y", slug: "good-slug" }).slug,
	).toBeUndefined();
});

it("builds the request body with an explicit status and no empty strings", () => {
	// `status` is always sent: the backend persists what the request asks for but
	// defaults an omitted status to ACTIVE, which would publish a draft-first
	// form's product by accident.
	const input = toProductCreateInput({
		name: "  Blue Dream Shrimp  ",
		description: "Hardy shrimp.",
		detailDescription: "",
		categoryId: "",
		slug: "",
		status: "DRAFT",
	});

	expect(input).toEqual({
		name: "Blue Dream Shrimp",
		description: "Hardy shrimp.",
		status: "DRAFT",
	});
	// An empty slug must be *absent*, not "": the backend derives one from the
	// name when the field is null, but rejects an empty string as an invalid slug.
	expect("slug" in input).toBe(false);
	expect("categoryId" in input).toBe(false);
	expect("detailDescription" in input).toBe(false);
});

it("keeps a supplied slug and category", () => {
	const input = toProductCreateInput({
		name: "Blue Dream Shrimp",
		description: "Hardy shrimp.",
		categoryId: "livestock",
		slug: "blue-dream-shrimp",
		status: "ACTIVE",
	});

	expect(input.categoryId).toBe("livestock");
	expect(input.slug).toBe("blue-dream-shrimp");
	expect(input.status).toBe("ACTIVE");
});

it("shows a category's full path so identical leaf names are distinguishable", () => {
	// The catalog has 115 categories; two leaves can share a name under different
	// parents, and a bare leaf name in a dropdown would be ambiguous.
	const options = categoryOptions(categories);

	expect(options).toEqual([
		{ value: "livestock", label: "Livestock" },
		{ value: "freshwater-fish", label: "Livestock / Freshwater fish" },
	]);
});
