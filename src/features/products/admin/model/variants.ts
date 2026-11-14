import type {
	UploadResult,
	VariantCreateInput,
	VariantDetail,
	VariantRecord,
	VariantUpdateInput,
} from "../../types";
import { describeAttributeLink } from "./product-attributes";

/**
 * The variant editor's row model.
 *
 * A product's variants are authored as explicit rows (ADR-0003): the backend
 * has no option model, so a row is nothing but `{sku, price, stock}` plus
 * attribute-value links. Everything the editor needs to *show* a row is
 * therefore derived here rather than stored, which is why the label comes from
 * the picks and not from a name the API does not have.
 */

/**
 * One image on a variant row.
 *
 * A projection of the aggregate's `media[]`, not the DTO: the row renders a
 * thumbnail, and nothing reads `createdAt`/`updatedAt`/`deleted`. Carrying the
 * whole `Media` would also mean inventing timestamps for a just-uploaded image,
 * whose `UploadResponse` does not include any.
 */
export interface VariantImage {
	mediaId: string;
	url: string;
}

/** One editable variant row, as the table holds it. */
export interface VariantRow {
	variantId: string;
	sku: string;
	price: number;
	stock: number;
	/**
	 * The revision paired with `stock` when the row was read.
	 *
	 * A stock write must state it: the backend compares it while holding the
	 * variant lock, so an edit based on stock that has since changed is refused
	 * instead of overwriting a checkout. Null means the response did not carry
	 * one; a stock edit then has no safe baseline and is refused before sending.
	 */
	stockRevision: number | null;
	/** The variant's attribute picks, reused by the shared `AttributePicker`. */
	attributes: VariantDetail["attributes"];
	/** The variant's images, most recent last, as the backend returns them. */
	images: VariantImage[];
}

/**
 * Projects the detail aggregate's variants into editor rows.
 *
 * The order is the backend's own, deliberately: `ProductService.getDetail`
 * sorts the `{slug}-default` variant first so the storefront's picker opens on
 * it, and the editor keeps that meaning — the first row *is* the default
 * variant. Re-sorting by SKU or price would silently change which one that is.
 */
export function toVariantRows(variants: readonly VariantDetail[]): VariantRow[] {
	return variants.map((variant) => ({
		variantId: variant.variantId,
		sku: variant.sku,
		price: variant.price,
		stock: variant.stock,
		stockRevision: variant.stockRevision,
		attributes: variant.attributes,
		images: variant.media.map((media) => ({
			mediaId: media.mediaId,
			url: media.url,
		})),
	}));
}

/**
 * The row's name in the table: its attribute picks, or the SKU when it has none.
 *
 * There is no variant name in the API, and a column showing only SKUs would
 * make `FISH-PENGUIN-TETRA` and `FISH-PENGUIN-TETRA-RED-TAIL` (same product,
 * different colour) look like an accident. A freshly added variant has no picks
 * yet, so the SKU is the only thing that identifies it — hence the fallback
 * rather than an empty cell.
 */
export function variantLabel(row: Pick<VariantRow, "sku" | "attributes">): string {
	if (row.attributes.length === 0) {
		return row.sku;
	}

	// One link's rendering is `describeAttributeLink`'s job (the product card
	// shows the same "Name: Value" text); the separator is the listing's.
	return row.attributes.map(describeAttributeLink).join(" · ");
}

/**
 * Total available stock across the rows on screen.
 *
 * Summed from the visible rows rather than read from `ProductResponse.stock`:
 * the product's number is derived server-side and only catches up on the next
 * read, so it would contradict the table after an edit. The card labels it as a
 * sum for exactly that reason.
 */
export function totalVariantStock(rows: readonly Pick<VariantRow, "stock">[]): number {
	return rows.reduce((sum, row) => sum + row.stock, 0);
}

/** The three fields a row actually edits. */
export interface VariantRowValues {
	sku: string;
	price: number;
	stock: number;
}

export type VariantRowErrors = Partial<Record<keyof VariantRowValues, string>>;

/**
 * Field-level validation mirroring the API's own annotations, one rule per
 * field so a form can validate a single input.
 *
 * `VariantCreateRequest` declares `sku` as `@NotBlank`, `price` as
 * `@PositiveOrZero`, and `stock` as a non-negative `Integer`. Catching the same
 * three here means an invalid value is refused at the field, rather than after a
 * round trip whose 400 would land in a page-level banner.
 *
 * A duplicate SKU is **not** checked here: uniqueness is global, so only the
 * server can answer it, and its 409 is rendered on the row's SKU field.
 */
export function validateVariantSku(value: string): string | undefined {
	return value.trim() === "" ? "Enter a SKU." : undefined;
}

export function validateVariantPrice(value: number): string | undefined {
	return !Number.isFinite(value) || value < 0
		? "Enter a price of 0 or more."
		: undefined;
}

export function validateVariantStock(value: number): string | undefined {
	return !Number.isInteger(value) || value < 0
		? "Enter a whole number of 0 or more."
		: undefined;
}

/** The three field rules together — what a whole row must satisfy. */
export function validateVariantRow(values: VariantRowValues): VariantRowErrors {
	const errors: VariantRowErrors = {};
	const sku = validateVariantSku(values.sku);
	const price = validateVariantPrice(values.price);
	const stock = validateVariantStock(values.stock);

	if (sku !== undefined) {
		errors.sku = sku;
	}

	if (price !== undefined) {
		errors.price = price;
	}

	if (stock !== undefined) {
		errors.stock = stock;
	}

	return errors;
}

/**
 * The `POST /variants` body. `stock` is sent even when 0, because 0 is a real
 * stock level while an omitted field falls back to the entity's own default.
 */
export function toVariantCreateInput(
	productId: string,
	values: VariantRowValues,
): VariantCreateInput {
	return {
		productId,
		sku: values.sku.trim(),
		price: values.price,
		stock: values.stock,
	};
}

/**
 * The `PATCH /variants/{variantId}` body for an edited row, or `null` when
 * nothing changed.
 *
 * **Returns a body, never a method.** Variants are the one place where the
 * question "merge or replace?" does not arise: `VariantService.replace` is
 * literally `return update(...)`, so `PUT` and `PATCH` are the same operation.
 * Products are the opposite — detaching a category *requires* `PUT` — which is
 * why the product's `buildProductRequest` returns `{method, body}` and why
 * reusing it here would invent a distinction the API does not have. Keeping the
 * variant path one function, with no method in its return type, is what makes
 * that mistake impossible to write rather than merely discouraged.
 */
export function buildVariantUpdate(
	saved: VariantRow,
	next: VariantRowValues,
): VariantUpdateInput | null {
	const update: VariantUpdateInput = {};

	// Compared trimmed: trailing whitespace from an input is not an edit, and
	// re-sending it on every blur would be a pointless write.
	const sku = next.sku.trim();

	if (sku !== saved.sku) {
		update.sku = sku;
	}

	if (next.price !== saved.price) {
		update.price = next.price;
	}

	if (next.stock !== saved.stock) {
		update.stock = next.stock;
		if (saved.stockRevision !== null) {
			// The baseline the edit was made against, not whatever a later read
			// would return: pairing a fresh revision with this older absolute
			// stock would let the request overwrite an intervening checkout.
			update.expectedStockRevision = saved.stockRevision;
		}
	}

	return Object.keys(update).length === 0 ? null : update;
}

/** What a saved `VariantResponse` replaces on a row: its fields and baseline. */
export type VariantRowFields = VariantRowValues & {
	stockRevision: number | null;
};

/**
 * The mutable fields from a `VariantResponse` — the DTO that
 * `POST /variants` and `PATCH /variants/{id}` both return.
 *
 * Its `stock` is a **nullable** `Integer` (`ProductService` overlays a scrubbed
 * null onto cached rows), unlike the detail embed's non-null one. `fallbackStock`
 * is therefore required rather than defaulted: a null means "the server did not
 * tell us", not "zero". A create has nothing to fall back to, so it passes `0`;
 * a patch must pass the row's current stock, because writing `0` there would
 * invent a stock level and silently zero the total.
 *
 * The revision is returned with the stock so a successful save moves the row's
 * baseline too; keeping an old revision after a save would fail the next edit.
 */
export function variantFieldsFromRecord(
	record: VariantRecord,
	fallbackStock: number,
): VariantRowFields {
	return {
		sku: record.sku,
		price: record.price,
		stock: record.stock ?? fallbackStock,
		stockRevision: record.stockRevision,
	};
}

/**
 * A row from a `VariantResponse`, as returned by `POST /variants`.
 *
 * That DTO carries **no `attributes`**, so a newly created row starts with none
 * and its label falls back to the SKU until the user picks some. `stock: 0` is
 * the right fallback here and only here: a brand-new variant has no prior value.
 */
export function rowFromVariantRecord(record: VariantRecord): VariantRow {
	return {
		variantId: record.variantId,
		...variantFieldsFromRecord(record, 0),
		attributes: [],
		// `VariantResponse` carries no media either; a new variant starts bare and
		// an image is added from its row.
		images: [],
	};
}

/**
 * The image an upload just created, in the row's own shape.
 *
 * `POST /uploads/variants/{id}` returns `{mediaId, url, …}`, so the thumbnail can
 * appear immediately without refetching the aggregate; it also returns no
 * timestamps, which is why `VariantImage` is a two-field projection rather than
 * the `Media` DTO.
 *
 * The caller **appends** this to the row's images rather than replacing the row:
 * the upload response describes only the image, so replacing a whole row with it
 * would revert a concurrent price or stock edit.
 */
export function variantImageFromUpload(upload: UploadResult): VariantImage {
	return { mediaId: upload.mediaId, url: upload.url };
}
