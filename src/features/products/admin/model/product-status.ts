import type { ProductStatus } from "@/types";
import { PRODUCT_STATUS_LABELS } from "@/lib/constants/labels";

/**
 * The product status vocabulary, in one place.
 *
 * The backend's enum is `DRAFT | ACTIVE | INACTIVE | DELETED`; the design's
 * three pills are Active / Draft / Archived. The two vocabularies are bridged
 * here — `INACTIVE` is what the design calls *Archived* (GLOSSARY.md) — so no
 * screen invents its own translation, and the `DELETED`-can-be-filtered-but-
 * not-assigned rule (ADR-0002) is enforced by the types below rather than by
 * each form remembering it.
 *
 * The labels themselves live in `@/lib/constants/labels`, shared with the rest
 * of the app. Only the admin-specific vocabulary (which statuses are *tones*,
 * which are *assignable*, which are *filterable*) belongs here.
 */

/**
 * A visual tone, not a colour: mapping it onto a palette is the component's
 * job, so this module stays free of design-token imports.
 *
 * Draft and Low stock share the warning tone, and Archived and Deleted share
 * the danger tone, exactly as the Figma board defines them. Every pill also
 * renders its label, so colour is never the only signal.
 */
export type ProductStatusTone = "success" | "warning" | "danger";

const TONES: Record<ProductStatus, ProductStatusTone> = {
	ACTIVE: "success",
	DRAFT: "warning",
	INACTIVE: "danger",
	DELETED: "danger",
};

/** The statuses a user may assign to a product. `DELETED` is absent on purpose. */
export type EditableProductStatus = Exclude<ProductStatus, "DELETED">;

/**
 * Ordered for the editor's status control: the draft-first flow reads top to
 * bottom, then publishing, then withdrawing.
 */
export const EDITABLE_PRODUCT_STATUSES: readonly EditableProductStatus[] = [
	"DRAFT",
	"ACTIVE",
	"INACTIVE",
];

/**
 * Ordered for the listing's filter, which must be able to reach deleted rows:
 * they are invisible under every other status.
 */
export const FILTERABLE_PRODUCT_STATUSES: readonly ProductStatus[] = [
	"DRAFT",
	"ACTIVE",
	"INACTIVE",
	"DELETED",
];

/** The label the design shows for a backend status. */
export function productStatusLabel(status: ProductStatus): string {
	return PRODUCT_STATUS_LABELS[status];
}

/** The visual tone for a backend status. */
export function productStatusTone(status: ProductStatus): ProductStatusTone {
	return TONES[status];
}

/**
 * Narrows any status to one the editor may show as selected.
 *
 * A deleted product cannot be "re-opened" by choosing Deleted in a dropdown, so
 * if one is ever opened for editing its status control selects Archived — the
 * closest assignable state — instead of claiming the product is still deleted.
 */
export function toEditableStatus(status: ProductStatus): EditableProductStatus {
	return status === "DELETED" ? "INACTIVE" : status;
}
