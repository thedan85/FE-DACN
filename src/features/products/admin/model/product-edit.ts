import type { Product, ProductUpdateInput } from "../../types";
import { toEditableStatus } from "./product-status";
import type { ProductFormValues } from "./product-form";

/**
 * Prefilling and diffing for the edit form.
 *
 * The form holds one value per editable field; this module turns the product
 * into those values and turns the edited values back into a request.
 *
 * **The method matters, not just the body.** `PATCH /products/{id}` merges: it
 * assigns a category only when one is supplied, so `categoryId: null` is a
 * silent no-op (`ProductService.update`, backend). Only `PUT` (replace) treats
 * a null category as "detach" — and the same method clears the thumbnail when
 * `thumbnailMediaId` is omitted, so a replace has to carry the current one to
 * avoid destroying an image the user never touched. `buildProductRequest`
 * therefore returns the method alongside the body; the difference is real
 * behaviour, not style.
 */

/** The editable view of a product, as the form holds it. */
export function toProductFormValues(product: Product): ProductFormValues {
	return {
		name: product.name,
		description: product.description,
		detailDescription: product.detailDescription,
		categoryId: product.categoryId ?? undefined,
		slug: product.slug,
		// A deleted product cannot be reopened by selecting "Deleted" in a form;
		// `toEditableStatus` maps it to Archived, the closest assignable state.
		status: toEditableStatus(product.status),
	};
}

/** Compares two text fields ignoring surrounding whitespace. */
function textChanged(
	next: string | undefined,
	previous: string | null | undefined,
): boolean {
	return (next ?? "").trim() !== (previous ?? "").trim();
}

/**
 * The changed fields, as a merge (`PATCH`) body.
 *
 * An empty object means "nothing to save", which is what both the save button
 * and the dirty-state guard key off.
 */
export function buildProductPatch(
	values: ProductFormValues,
	product: Product,
): ProductUpdateInput {
	const patch: ProductUpdateInput = {};

	if (textChanged(values.name, product.name)) {
		patch.name = values.name.trim();
	}

	if (textChanged(values.description, product.description)) {
		patch.description = values.description.trim();
	}

	if (textChanged(values.detailDescription, product.detailDescription)) {
		// "" clears the column; omitting the key would keep the old text.
		patch.detailDescription = (values.detailDescription ?? "").trim();
	}

	const currentCategory = product.categoryId ?? "";
	const nextCategory = values.categoryId ?? "";

	if (nextCategory !== currentCategory) {
		// `null` is how the form says "no category"; whether that detaches depends
		// on the method, which `buildProductRequest` decides.
		patch.categoryId = nextCategory === "" ? null : nextCategory;
	}

	const currentSlug = product.slug;
	const nextSlug = (values.slug ?? "").trim();

	if (nextSlug !== "" && nextSlug !== currentSlug) {
		// An unchanged slug stays out of the payload; a blank one means "keep the
		// current slug", so it is omitted rather than sent as "".
		patch.slug = nextSlug;
	}

	// Compared against the *assignable* status: a DELETED product opens as
	// Archived, and treating that as a pending change would mark the form dirty
	// on load and offer to "restore" a deleted row.
	if (values.status !== toEditableStatus(product.status)) {
		patch.status = values.status;
	}

	return patch;
}

/** True when the form has anything worth saving. */
export function hasProductChanges(
	values: ProductFormValues,
	product: Product,
): boolean {
	return Object.keys(buildProductPatch(values, product)).length > 0;
}

export interface ProductUpdateRequestPlan {
	/** `PATCH` merges; `PUT` replaces (and is the only method that detaches). */
	method: "PATCH" | "PUT";
	body: ProductUpdateInput;
}

/**
 * The product's current values, as the body of a replace.
 *
 * A `PUT` restates the whole product, so anything that needs one — detaching a
 * category here, clearing a thumbnail in `model/media.ts` — starts from this and
 * overrides the one field it means to change. Keeping one definition means a
 * future product field is added here and nowhere else.
 *
 * `categoryId` is `null` rather than omitted: `replace` detaches on null, and
 * sending `""` would be a malformed id.
 */
export function productCurrentValues(product: Product): ProductUpdateInput {
	return {
		name: product.name,
		description: product.description,
		detailDescription: product.detailDescription,
		categoryId: product.categoryId ?? null,
		slug: product.slug,
		status: product.status,
		thumbnailMediaId: product.thumbnailMediaId,
	};
}

/**
 * Decides the HTTP method and body for the pending edit.
 *
 * A cleared category is the one case that needs a replace, because a merge
 * ignores the null. The replace body is the product's full current state with
 * the edit applied, including `thumbnailMediaId`: a replace that omits it
 * clears the thumbnail, and detaching a category must not silently delete an
 * image.
 *
 * Returns `null` when there is nothing to send.
 */
export function buildProductRequest(
	values: ProductFormValues,
	product: Product,
): ProductUpdateRequestPlan | null {
	const patch = buildProductPatch(values, product);

	if (Object.keys(patch).length === 0) {
		return null;
	}

	const detachesCategory = patch.categoryId === null;

	if (!detachesCategory) {
		return { method: "PATCH", body: patch };
	}

	return {
		method: "PUT",
		body: {
			...productCurrentValues(product),
			name: values.name.trim(),
			description: values.description.trim(),
			detailDescription: (values.detailDescription ?? "").trim(),
			categoryId: null,
			slug: values.slug?.trim() || product.slug,
			status: values.status,
			// Preserved deliberately — see the doc comment.
			thumbnailMediaId: product.thumbnailMediaId,
		},
	};
}
