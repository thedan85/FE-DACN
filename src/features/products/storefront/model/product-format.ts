/** Display-only price/date formatting helpers (backend stays authoritative). */

const vndFormatter = new Intl.NumberFormat("vi-VN", {
	style: "currency",
	currency: "VND",
});

export function formatVndPrice(value: number): string {
	return vndFormatter.format(value);
}

/**
 * Formats a product's price for the listing card:
 *
 * - `min === max` → a single price ("20.000 ₫")
 * - otherwise     → the variant range ("60.000 ₫ – 90.000 ₫")
 * - missing data  → `null` so callers can render an "unavailable" state
 */
export function formatPriceRange(
	minPrice: number | null | undefined,
	maxPrice: number | null | undefined,
): string | null {
	if (minPrice == null || maxPrice == null) {
		return null;
	}

	if (minPrice === maxPrice) {
		return formatVndPrice(minPrice);
	}

	return `${formatVndPrice(minPrice)} – ${formatVndPrice(maxPrice)}`;
}
