import { apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import {
	createApiResponseSchema,
	nullDataResponseSchema,
} from "@/lib/api/schema";

import { getAuthHeaders } from "@/features/auth/session";
import { VariantSchema } from "../../schema/catalog.schema";
import type {
	VariantCreateInput,
	VariantRecord,
	VariantUpdateInput,
} from "../../types";

/**
 * Admin variant API, mirrored from `VariantController` / `VariantService`
 * (verified live 2026-11-03).
 *
 * A variant is the only place price and stock live: there is no product-level
 * price, and a product's `minPrice`/`maxPrice`/`stock` are derived from its
 * non-deleted variants. Rows are created one at a time — the backend has no
 * option model and no bulk endpoint (ADR-0003).
 */

const variantResponseSchema = createApiResponseSchema(VariantSchema);

/**
 * Creates a variant and returns it with its generated `variantId`, so the
 * editor can attach attribute links and later patch the row by id.
 *
 * The SKU is globally unique: a duplicate is a 409 carrying the backend's
 * message, which belongs on the row's SKU field.
 */
export async function createVariant(
	input: VariantCreateInput,
): Promise<VariantRecord> {
	const payload = await apiFetch<unknown>("variants", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(input),
	});

	return parseOrThrow(
		variantResponseSchema,
		payload,
		"The created variant response",
	).data;
}

/** Merges the provided fields; omitted ones are left unchanged. */
export async function patchVariant(
	variantId: string,
	input: VariantUpdateInput,
): Promise<VariantRecord> {
	if (input.stock !== undefined && input.expectedStockRevision === undefined) {
		// The revision belongs to the stock value the caller actually edited.
		// Reading a newer one here would pair it with older absolute stock and
		// overwrite whatever changed in between, so refuse instead of guessing.
		throw new Error("Stock revision unavailable; refresh this variant.");
	}
	const payload = await apiFetch<unknown>(
		`variants/${encodeURIComponent(variantId)}`,
		{
			method: "PATCH",
			headers: getAuthHeaders(),
			body: JSON.stringify(input),
		},
	);

	return parseOrThrow(
		variantResponseSchema,
		payload,
		"The updated variant response",
	).data;
}

/**
 * Removes a variant by setting `deleted = true` — a soft delete, so the row
 * survives and the product's price range and stock recompute without it.
 */
export async function deleteVariant(variantId: string): Promise<void> {
	const payload = await apiFetch<unknown>(
		`variants/${encodeURIComponent(variantId)}`,
		{
			method: "DELETE",
			headers: getAuthHeaders(),
		},
	);

	parseOrThrow(
		nullDataResponseSchema,
		payload,
		"The delete-variant response",
	);
}
