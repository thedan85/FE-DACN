import type { ReviewSummary } from "../model/review-summary";
import { summaryScopeLabel } from "../model/review-summary";
import { StarSlashIcon } from "./product-detail-icons";
import { RatingStars } from "./rating-stars";

import styles from "./product-rating-summary.module.css";

type ProductRatingSummaryProps = {
	summary: ReviewSummary;
};

const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

/**
 * The reference's 340px score card — big average, stars and per-star bars.
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
				<p className={styles.average}>
					{average != null ? average.toFixed(1) : "—"}
				</p>
				<RatingStars value={average ?? 0} />
				<p className={styles.total}>
					Based on {summary.total}{" "}
					{summary.total === 1 ? "review" : "reviews"}
				</p>
			</div>

			<ul className={styles.bars}>
				{STAR_LEVELS.map((level) => {
					const count = summary.counts[5 - level] ?? 0;
					const share =
						summary.loaded > 0 ? (count / summary.loaded) * 100 : 0;

					return (
						<li key={level} className={styles.barRow}>
							<span className={styles.barLabel}>{level}</span>
							<StarSlashIcon
								className={styles.barStar}
								size={10}
							/>
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
