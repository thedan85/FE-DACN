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

export const STORE_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * Compact, locale-stable date for review timestamps ("26 Oct 2026").
 * Day-first to match the storefront's Vietnamese market convention.
 * An optional time zone pins the day boundary to the store's zone.
 * An unparseable value yields `null` so the caller can omit the date
 * instead of rendering "Invalid Date".
 */
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
	day: "numeric",
	month: "short",
	year: "numeric",
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", DATE_FORMAT_OPTIONS);

export function formatDate(
	iso: string | null | undefined,
	timeZone?: string,
): string | null {
	if (!iso) {
		return null;
	}

	const date = new Date(iso);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	const formatter = timeZone
		? new Intl.DateTimeFormat("en-GB", { ...DATE_FORMAT_OPTIONS, timeZone })
		: dateFormatter;

	return formatter.format(date);
}

/**
 * Splits a plain-text description into paragraphs (D19 — no rich text).
 *
 * The backend stores `detailDescription` as plain text with `\r\n`
 * separators. Each non-empty, trimmed line becomes one paragraph;
 * whitespace-only lines are dropped, so a blank-line separator simply
 * disappears. No markup is ever parsed or injected.
 */
export function splitParagraphs(text: string | null | undefined): string[] {
	if (!text) {
		return [];
	}

	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}
