import { Rate } from "antd";

import type { ReviewSummary } from "../model/review-summary";
import { summaryScopeLabel } from "../model/review-summary";

import styles from "./product-rating-summary.module.css";

type ProductRatingSummaryProps = {
	summary: ReviewSummary;
};

const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

/**
 * Section 4 score block — average, total count and per-star 5→1 counts with
 * proportional bar meters (antd has no rating-bar primitive, so the meters
 * are plain CSS).
 *
 * Every figure is derived from the **loaded** review page. When the backend
 * reports more reviews than were loaded, the block is labelled accordingly
 * instead of implying it covers all of them (plan §3.4 / D15).
 */
export function ProductRatingSummary({ summary }: ProductRatingSummaryProps) {
	const scopeLabel = summaryScopeLabel(summary);
	const average = summary.average;

	return (
		<div className={styles.root}>
			<div className={styles.score}>
				<span className={styles.average}>
					{average != null ? average.toFixed(1) : "—"}
				</span>

				<div className={styles.scoreMeta}>
					<Rate
						className={styles.stars}
						value={average ?? 0}
						allowHalf
						disabled
						aria-label={
							average != null
								? `Average rating ${average.toFixed(1)} out of 5`
								: "No rating yet"
						}
					/>
					<p className={styles.total}>
						{summary.total} {summary.total === 1 ? "review" : "reviews"}
					</p>
				</div>
			</div>

			<ul className={styles.bars}>
				{STAR_LEVELS.map((level) => {
					const count = summary.counts[5 - level] ?? 0;
					const share =
						summary.loaded > 0 ? (count / summary.loaded) * 100 : 0;

					return (
						<li key={level} className={styles.barRow}>
							<span className={styles.barLabel}>{level}</span>
							<span
								className={styles.barTrack}
								role="img"
								aria-label={`${level} star: ${count} ${
									count === 1 ? "review" : "reviews"
								}`}
							>
								<span
									className={styles.barFill}
									style={{ inlineSize: `${share}%` }}
								/>
							</span>
							<span className={styles.barCount}>{count}</span>
						</li>
					);
				})}
			</ul>

			{scopeLabel && <p className={styles.scope}>{scopeLabel}</p>}
		</div>
	);
}
