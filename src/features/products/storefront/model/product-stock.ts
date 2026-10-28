import type { VariantDetail } from "../../types";

/**
 * Stock display helpers derived from the backend's stock fields
 * (`ProductResponse.stock`, `VariantDetailResponse.stock`, added with defect
 * N2 / verified 2026-10-26).
 *
 * These are **display hints only** — the backend remains authoritative for
 * availability when an order is placed. A missing value is treated as 0
 * rather than guessed at, so the UI never claims stock it cannot see.
 */

/** Coerces the DTO's possibly-absent stock to a usable non-negative count. */
export function totalStock(stock: number | null | undefined): number {
	return stock == null || stock < 0 ? 0 : stock;
}

/** True when the product has no purchasable units left. */
export function isOutOfStock(stock: number | null | undefined): boolean {
	return totalStock(stock) === 0;
}

/** True when a specific variant cannot be purchased. */
export function variantSoldOut(variant: VariantDetail): boolean {
	return totalStock(variant.stock) === 0;
}

/**
 * Human label for a stock count (plan §6 — text, never colour alone):
 *
 * - `0` or missing → "Out of stock"
 * - otherwise      → "In stock: N"
 */
export function stockLabel(stock: number | null | undefined): string {
	const count = totalStock(stock);

	return count === 0 ? "Out of stock" : `In stock: ${count}`;
}
