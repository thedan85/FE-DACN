import { getAncestorChain } from "../../storefront/model/category-tree";
import type { Category } from "../../types";
import type { ProductCreateInput } from "../../types";
import type { EditableProductStatus } from "./product-status";
import { validateSlug } from "./slug";

/**
 * The create form's values and the rules that turn them into a request.
 *
 * Kept out of the component so the mapping can be tested: the two things most
 * likely to be wrong are silent — sending `""` where the API wants the field
 * absent, and omitting `status` so the backend publishes the product.
 */

/** `ProductCreateRequest.name` is `@Size(max = 255)`. */
const MAX_NAME_LENGTH = 255;

export type ProductFormValues = {
	name: string;
	description: string;
	detailDescription?: string;
	categoryId?: string;
	slug?: string;
	/**
	 * Narrowed to the assignable statuses: `DELETED` is the outcome of the delete
	 * action, never a value this form can send (ADR-0002).
	 */
	status: EditableProductStatus;
};

export type ProductFormErrors = Partial<
	Record<"name" | "description" | "slug", string>
>;

/**
 * Validates the fields the API requires plus the slug's own rules.
 *
 * `description` is required by `ProductCreateRequest` (`@NotBlank`), which is
 * easy to miss: the design shows it as an optional rich-text area, but a
 * product without one cannot be created.
 */
export function validateProductForm(
	values: Partial<ProductFormValues>,
): ProductFormErrors {
	const errors: ProductFormErrors = {};
	const name = values.name?.trim() ?? "";
	const description = values.description?.trim() ?? "";

	if (name === "") {
		errors.name = "Enter a product title.";
	} else if (name.length > MAX_NAME_LENGTH) {
		errors.name = `Use at most ${MAX_NAME_LENGTH} characters.`;
	}

	if (description === "") {
		errors.description = "Enter a description.";
	}

	const slugError = validateSlug(values.slug ?? "");

	if (slugError !== null) {
		errors.slug = slugError;
	}

	return errors;
}

/**
 * Builds the create request.
 *
 * Two deliberate omissions:
 *
 * - **`status` is always present.** The backend persists what the request asked
 *   for, but defaults an omitted status to ACTIVE (`ProductService.create`), so
 *   leaving it out would publish a draft-first form's product by accident.
 * - **Empty strings are dropped, not sent.** `slug: ""` is an invalid slug to the
 *   API (it 400s), while an *absent* slug means "derive one from the name"; the
 *   same holds for `categoryId` and `detailDescription`, which map to nullable
 *   columns.
 */
export function toProductCreateInput(
	values: ProductFormValues,
): ProductCreateInput {
	const input: ProductCreateInput = {
		name: values.name.trim(),
		description: values.description.trim(),
		status: values.status,
	};

	const detailDescription = values.detailDescription?.trim();

	if (detailDescription) {
		input.detailDescription = detailDescription;
	}

	if (values.categoryId) {
		input.categoryId = values.categoryId;
	}

	const slug = values.slug?.trim();

	if (slug) {
		input.slug = slug;
	}

	return input;
}

/**
 * Category select options, labelled with the full path.
 *
 * A leaf name alone is ambiguous in a 115-category catalog — several leaves
 * share a name under different parents — so each label reads
 * `Livestock / Freshwater fish`.
 */
export function categoryOptions(
	categories: Category[],
): { value: string; label: string }[] {
	return categories.map((category) => ({
		value: category.categoryId,
		label: getAncestorChain(categories, category.categoryId)
			.map((ancestor) => ancestor.name)
			.join(" / "),
	}));
}
