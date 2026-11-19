import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import {
	createApiResponseSchema,
	createPageResponseSchema,
	nullDataResponseSchema,
} from "@/lib/api/schema";

import { getAuthHeaders } from "@/features/auth/session";
import { CategorySchema } from "../../schema/catalog.schema";
import type { Category, CategoryPage } from "../../types";

/**
 * Admin category API (`/categories` — no `/admin` prefix; see the contract
 * doc), mirrored from `CategoryController` / `CategoryService`.
 *
 * Two contract facts shape this module:
 *
 * - **Reads are public and paged.** `GET` walks every page so the editor
 *   never sees a silently truncated hierarchy — a lone page would render a
 *   tree with missing parents. The storefront reader in the sibling
 *   `api/products.api.ts` stays untouched; this one sends auth headers and
 *   opts out of the data cache, which is what the admin portal needs.
 * - **`PATCH` merges, `PUT` replaces.** A `null`/omitted `parentCategoryId`
 *   on `PATCH` keeps the current parent, so renaming alone is a `PATCH` with
 *   no `parentCategoryId` key. Detaching to the root requires `PUT` with
 *   `{ parentCategoryId: null }`; there is no detach path through `PATCH`.
 */

const categoryPageResponseSchema = createApiResponseSchema(
	createPageResponseSchema(CategorySchema),
);

const categoryResponseSchema = createApiResponseSchema(CategorySchema);

/** The backend caps `size` at 100, so this is the widest legal page. */
const PAGE_SIZE = 100;

async function fetchCategoryPage(page: number): Promise<CategoryPage> {
	const payload = await apiFetch<unknown>(
		`categories?page=${page}&size=${PAGE_SIZE}`,
		{ headers: getAuthHeaders() },
	);

	return parseOrThrow(
		categoryPageResponseSchema,
		payload,
		"The category list response",
	).data;
}

/**
 * Every category, flattened across pages in server order. Presentation order
 * is the caller's job: the page order carries no hierarchy meaning, so the
 * hierarchy helpers sort by name.
 */
export async function listAdminCategories(): Promise<Category[]> {
	const first = await fetchCategoryPage(0);

	if (first.totalPages <= 1) {
		return first.content;
	}

	const remaining = await Promise.all(
		Array.from({ length: first.totalPages - 1 }, (_, index) =>
			fetchCategoryPage(index + 1),
		),
	);

	return [
		...first.content,
		...remaining.flatMap((pageData) => pageData.content),
	];
}

export interface CreateCategoryInput {
	name: string;
	slug: string;
	parentCategoryId?: string;
}

/**
 * Creates a category. A duplicate slug is a 409 and reaches the caller as an
 * `ApiError` carrying the backend's message — surface it on the slug field
 * rather than retrying.
 */
export async function createCategory(
	input: CreateCategoryInput,
): Promise<Category> {
	const payload = await apiFetch<unknown>("categories", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(input),
	});

	return parseOrThrow(
		categoryResponseSchema,
		payload,
		"The created category response",
	).data;
}

export interface PatchCategoryInput {
	name?: string;
	slug?: string;
	parentCategoryId?: string;
}

/**
 * Patches a category: only the provided fields change. `parentCategoryId` is
 * accepted here only as a non-null move; detaching to the root is
 * `moveCategoryToRoot`, because a `null` parent on `PATCH` is a silent no-op.
 */
export async function patchCategory(
	id: string,
	input: PatchCategoryInput,
): Promise<Category> {
	const payload = await apiFetch<unknown>(
		`categories/${encodeURIComponent(id)}`,
		{
			method: "PATCH",
			headers: getAuthHeaders(),
			body: JSON.stringify(input),
		},
	);

	return parseOrThrow(
		categoryResponseSchema,
		payload,
		"The updated category response",
	).data;
}

/**
 * Detaches a category to the root: one `PUT` with `{ parentCategoryId: null }`.
 * `PUT` (not `PATCH`) is the only verb that can express the detach.
 */
export async function moveCategoryToRoot(id: string): Promise<Category> {
	const payload = await apiFetch<unknown>(
		`categories/${encodeURIComponent(id)}`,
		{
			method: "PUT",
			headers: getAuthHeaders(),
			body: JSON.stringify({ parentCategoryId: null }),
		},
	);

	return parseOrThrow(
		categoryResponseSchema,
		payload,
		"The updated category response",
	).data;
}

/**
 * Deletes a category. The backend soft-deletes the row and applies no child
 * guard, so the UI must refuse to delete a category that still has children
 * in the loaded hierarchy — otherwise they silently orphan.
 */
export async function deleteCategory(id: string): Promise<void> {
	const payload = await apiFetch<unknown>(
		`categories/${encodeURIComponent(id)}`,
		{
			method: "DELETE",
			headers: getAuthHeaders(),
		},
	);

	parseOrThrow(
		nullDataResponseSchema,
		payload,
		"The delete-category response",
	);
}
