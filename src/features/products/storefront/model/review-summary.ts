import type { Review, ReviewPage } from "../../types";

/**
 * Review aggregation for Section 4 (D15).
 *
 * Everything here is computed from the **loaded page** of reviews — the
 * aggregate endpoint returns a `PageResponse` (backend defect N8, fixed in
 * `f758bae`) with a default size of 20 and a backend cap of 100. When the
 * page does not cover every review, `partial` is true and the UI must label
 * the figures "based on the latest N reviews" rather than present them as
 * global numbers (plan §3.4 — never fabricate completeness).
 */

export interface ReviewSummary {
	/** What the backend reports as the real review count. */
	total: number;
	/** How many reviews were actually loaded on this page. */
	loaded: number;
	/** Mean of the loaded reviews, 1 decimal place; `null` when none. */
	average: number | null;
	/** Per-star counts ordered 5 → 1 (`counts[0]` is the 5-star count). */
	counts: number[];
	/** True when the loaded page does not cover every review. */
	partial: boolean;
}

/** Arithmetic mean of the loaded ratings, rounded to 1 decimal place. */
export function averageRating(reviews: Review[]): number | null {
	if (reviews.length === 0) {
		return null;
	}

	const sum = reviews.reduce((total, review) => total + review.rating, 0);

	return Math.round((sum / reviews.length) * 10) / 10;
}

/** Per-star histogram ordered 5 → 1; out-of-range ratings are ignored. */
export function ratingCounts(reviews: Review[]): number[] {
	const counts = [0, 0, 0, 0, 0];

	for (const review of reviews) {
		const index = 5 - review.rating;

		if (index >= 0 && index < counts.length) {
			counts[index] += 1;
		}
	}

	return counts;
}

/** The backend's true review count for the product. */
export function totalReviews(page: ReviewPage): number {
	return page.totalElements;
}

/** Builds the summary the score block renders from one loaded page. */
export function summarizeReviews(page: ReviewPage): ReviewSummary {
	const loaded = page.content.length;

	return {
		total: totalReviews(page),
		loaded,
		average: averageRating(page.content),
		counts: ratingCounts(page.content),
		partial: page.totalElements > loaded,
	};
}

/**
 * Label for the score block when the loaded page is incomplete — plan §3.4.
 * Returns `null` when the summary covers every review (the normal case
 * while review volume is small).
 */
export function summaryScopeLabel(summary: ReviewSummary): string | null {
	if (!summary.partial || summary.loaded === 0) {
		return null;
	}

	return `Based on the latest ${summary.loaded} review${
		summary.loaded === 1 ? "" : "s"
	}`;
}
