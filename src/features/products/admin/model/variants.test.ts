import { expect, it } from "vitest";

import type { VariantDetail } from "../../types";
import {
	buildVariantUpdate,
	rowFromVariantRecord,
	toVariantCreateInput,
	toVariantRows,
	totalVariantStock,
	validateVariantRow,
	variantFieldsFromRecord,
	variantLabel,
	type VariantRow,
} from "./variants";

/**
 * The variant row model.
 *
 * A variant row is what the editor shows for one `VariantDetailResponse` from
 * the product-detail aggregate: SKU, price, stock and its attribute picks. The
 * backend has no option model (ADR-0003), so the row's *label* has to be
 * derived from the picks — a row showing only a SKU would be unreadable next to
 * `FISH-PENGUIN-TETRA` and `FISH-PENGUIN-TETRA-RED-TAIL`.
 */

function variant(
	variantId: string,
	sku: string,
	price: number,
	stock: number,
	picks: { attributeId: string; name: string; value: string }[] = [],
): VariantDetail {
	return {
		variantId,
		sku,
		price,
		stock,
		attributes: picks.map((pick, index) => ({
			variantValueId: `${variantId}-${pick.attributeId}`,
			variantId,
			attributeId: pick.attributeId,
			attributeName: pick.name,
			attributeValueId: `${pick.attributeId}-${index}`,
			attributeValue: pick.value,
			createdAt: "2026-10-27T16:28:35.817562Z",
		})),
		media: [],
	};
}

/** The real payload for `penguin-tetra`, read from the dev backend. */
const penguinTetra = [
	variant("penguin-tetra-default", "FISH-PENGUIN-TETRA", 15000, 50, [
		{ attributeId: "color", name: "Color", value: "Normal" },
	]),
	variant("penguin-tetra-red-tail", "FISH-PENGUIN-TETRA-RED-TAIL", 18000, 50, [
		{ attributeId: "color", name: "Color", value: "Red Tail" },
	]),
];

/** The same two variants as editor rows. */
const penguinTetraRows = toVariantRows(penguinTetra);

it("keeps the backend's order, so the default variant stays first", () => {
	// `ProductService.getDetail` sorts the `{slug}-default` variant first; the
	// editor must not re-sort, or the first row stops being the default one.
	const rows = toVariantRows(penguinTetra);

	expect(rows.map((row) => row.variantId)).toEqual([
		"penguin-tetra-default",
		"penguin-tetra-red-tail",
	]);
	expect(rows[0]?.sku).toBe("FISH-PENGUIN-TETRA");
});

it("labels a row by its attribute picks, not its SKU", () => {
	const rows = toVariantRows(penguinTetra);

	expect(variantLabel(rows[1]!)).toBe("Color: Red Tail");
});

it("joins several picks in the order the backend returned them", () => {
	const row = toVariantRows([
		variant("v1", "SHR-1", 1000, 1, [
			{ attributeId: "color", name: "Color", value: "Blue Dream" },
			{ attributeId: "size", name: "Size", value: "2-2.5 cm" },
		]),
	])[0]!;

	// " · " is what the listing's expanded variant panel already joins with, so
	// the same variant reads the same way in both places.
	expect(variantLabel(row)).toBe("Color: Blue Dream · Size: 2-2.5 cm");
});

it("falls back to the SKU when the variant has no picks", () => {
	// A new variant has no attributes until they are added, so the row must
	// still be identifiable in the table.
	const row = toVariantRows([variant("v1", "SHR-NEW", 1000, 1)])[0]!;

	expect(variantLabel(row)).toBe("SHR-NEW");
});

it("sums the stock of the rows on screen", () => {
	// This is the card's "Total available stock". It sums exactly the rows the
	// user can see, which is why it is computed here and not read from the
	// product response (that number lags a client-side change).
	expect(totalVariantStock(toVariantRows(penguinTetra))).toBe(100);
	expect(totalVariantStock([])).toBe(0);
});

it("accepts a complete row", () => {
	expect(validateVariantRow({ sku: "FISH-1", price: 15000, stock: 3 })).toEqual(
		{},
	);
});

it("requires a non-blank SKU", () => {
	// SKU is `@NotBlank` on the create request and globally unique; whitespace
	// would be trimmed to "" and 400 at the API instead of on the field.
	expect(validateVariantRow({ sku: "   ", price: 0, stock: 0 }).sku).toBeDefined();
	expect(validateVariantRow({ sku: "", price: 0, stock: 0 }).sku).toBeDefined();
});

it("rejects a negative price, because the DTO's minimum is 0", () => {
	// `price` is `@PositiveOrZero`; a negative value is a 400, so it is caught
	// on the field rather than in the request.
	expect(
		validateVariantRow({ sku: "FISH-1", price: -1, stock: 0 }).price,
	).toBeDefined();
	// Zero is legal — a free variant is odd but not invalid.
	expect(
		validateVariantRow({ sku: "FISH-1", price: 0, stock: 0 }).price,
	).toBeUndefined();
});

it("rejects stock that is negative or not a whole number", () => {
	expect(
		validateVariantRow({ sku: "FISH-1", price: 0, stock: -1 }).stock,
	).toBeDefined();
	expect(
		validateVariantRow({ sku: "FISH-1", price: 0, stock: 1.5 }).stock,
	).toBeDefined();
	expect(
		validateVariantRow({ sku: "FISH-1", price: 0, stock: 0 }).stock,
	).toBeUndefined();
});

it("builds the create payload with the fields the endpoint requires", () => {
	// `POST /variants` needs `productId`, `sku` and `price`; `stock` is optional
	// on the DTO but always sent, because 0 is a meaningful stock level and an
	// omitted stock would fall to the entity's own default.
	expect(
		toVariantCreateInput("PRD_172", { sku: "  FISH-NEW  ", price: 15000, stock: 4 }),
	).toEqual({
		productId: "PRD_172",
		sku: "FISH-NEW",
		price: 15000,
		stock: 4,
	});
});

it("sends only the fields that differ on an existing row", () => {
	// The variant DTO has no nullable field, and the mapper ignores nulls, so a
	// merge is safe here in the way it is *not* for products — but re-sending
	// unchanged fields still risks clobbering a concurrent edit.
	const saved: VariantRow = {
		variantId: "v1",
		sku: "FISH-1",
		price: 15000,
		stock: 50,
		attributes: [],
		images: [],
	};

	expect(buildVariantUpdate(saved, { ...saved, price: 18000 })).toEqual({
		price: 18000,
	});
});

it("returns null when a row was not changed", () => {
	const saved: VariantRow = {
		variantId: "v1",
		sku: "FISH-1",
		price: 15000,
		stock: 50,
		attributes: [],
		images: [],
	};

	// The editor keeps an inline row editable, so "unchanged" has to be
	// distinguishable from "changed" or every blur would fire a PATCH.
	expect(buildVariantUpdate(saved, saved)).toBeNull();
	expect(
		buildVariantUpdate(saved, { ...saved, sku: "  FISH-1  " }),
	).toBeNull();
});

it("always writes with PATCH, never choosing a method", () => {
	// `VariantService.replace` is literally `return update(...)`, so PATCH and
	// PUT are identical for variants — unlike products, where clearing the
	// category requires PUT. This builder therefore returns a **body only**:
	// there is no method for a caller to get wrong, which is why the product's
	// `buildProductRequest` must not be reused here.
	const update = buildVariantUpdate(
		{ variantId: "v1", sku: "A", price: 1, stock: 1, attributes: [], images: [] },
		{ sku: "B", price: 1, stock: 1 },
	);

	expect(update).toEqual({ sku: "B" });
	expect(Object.keys(update ?? {})).not.toContain("method");
});

it("turns a create response into a row, which has no picks yet", () => {
	// `POST /variants` returns `VariantResponse`, not the detail embed: it has no
	// `attributes` or `media`, so a new row starts with no picks and the label
	// falls back to its SKU until attributes are added.
	const row = rowFromVariantRecord({
		variantId: "VAR_FISH-NEW",
		sku: "FISH-NEW",
		price: 15000,
		stock: 4,
		productId: "PRD_172",
		productName: "Penguin Tetra",
		deleted: false,
		createdAt: "",
		updatedAt: "",
	});

	expect(row).toEqual({
		variantId: "VAR_FISH-NEW",
		sku: "FISH-NEW",
		price: 15000,
		stock: 4,
		attributes: [],
		// `VariantResponse` carries no media either, so a new row starts bare.
		images: [],
	});
});

it("treats a null stock in a variant response as zero", () => {
	// `VariantResponse.stock` is a nullable `Integer` in the DTO (ProductService
	// overlays a scrubbed null onto cached rows), unlike the detail embed's
	// non-null stock. A null turned into NaN would poison the total-stock sum.
	const row = rowFromVariantRecord({
		variantId: "VAR_X",
		sku: "SKU-X",
		price: 1,
		stock: null,
		productId: "PRD_172",
		productName: "Penguin Tetra",
		deleted: false,
		createdAt: "",
		updatedAt: "",
	});

	expect(row.stock).toBe(0);
	expect(totalVariantStock([row])).toBe(0);
});

it("keeps a row's picks when a PATCH response omits them", () => {
	// The same DTO comes back from PATCH, so its missing `attributes` must not
	// wipe what the row already had. Only the three fields it does carry are
	// taken, and the caller merges them onto its own row.
	const fields = variantFieldsFromRecord(
		{
			variantId: "penguin-tetra-red-tail",
			sku: "FISH-PENGUIN-TETRA-RED-TAIL",
			price: 19000,
			stock: 42,
			productId: "PRD_172",
			productName: "Penguin Tetra",
			deleted: false,
			createdAt: "",
			updatedAt: "",
		},
		penguinTetraRows[1]!.stock,
	);

	expect(fields).toEqual({
		sku: "FISH-PENGUIN-TETRA-RED-TAIL",
		price: 19000,
		stock: 42,
	});
	// Merging those onto the row leaves its picks untouched.
	const merged = { ...penguinTetraRows[1]!, ...fields };

	expect(merged.attributes).toBe(penguinTetra[1]!.attributes);
	expect(variantLabel(merged)).toBe("Color: Red Tail");
});

it("does not invent a stock level when a PATCH response carries null", () => {
	// `VariantResponse.stock` is a nullable Integer: the backend scrubs it on
	// cached rows. A null means "not reported", so a patch must fall back to the
	// row's own value — coercing it to 0 would zero a real stock level *and* the
	// card's total, with no error anywhere to explain the disappearance.
	const saved = penguinTetraRows[1]!;

	const fields = variantFieldsFromRecord(
		{
			variantId: saved.variantId,
			sku: saved.sku,
			price: 19000,
			stock: null,
			productId: "PRD_172",
			productName: "Penguin Tetra",
			deleted: false,
			createdAt: "",
			updatedAt: "",
		},
		saved.stock,
	);

	expect(fields.stock).toBe(50);
	expect(totalVariantStock([{ ...saved, ...fields }])).toBe(50);
});
