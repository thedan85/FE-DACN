import { Card, Rate, Tag } from "antd";

import { EmptyState } from "@/components/feedback/empty-state";

import type { ReviewPage } from "../../types";
import { formatDate } from "../model/product-format";
import { summarizeReviews } from "../model/review-summary";
import { ProductRatingSummary } from "./product-rating-summary";

import styles from "./product-reviews.module.css";

type ProductReviewsProps = {
	/** The aggregate's `reviews` page (default size 20, backend cap 100). */
	reviews: ReviewPage;
};

/**
 * Section 4 — score block + review list.
 *
 * Fully implemented with an honest empty state (decision D15): the seed data
 * currently has no reviews at all, so the score block is hidden and the list
 * shows "No reviews yet" rather than invented numbers. Reviewer names come
 * from `customerName` (backend defect N7, fixed in `f758bae`); a missing
 * name degrades to a neutral label, never to an opaque id.
 */
export function ProductReviews({ reviews }: ProductReviewsProps) {
	const summary = summarizeReviews(reviews);

	return (
		<Card
			className={styles.card}
			title={<h2 className={styles.header}>Customer reviews</h2>}
		>
			{summary.total === 0 ? (
				<EmptyState description="No reviews yet" />
			) : (
				<div className={styles.content}>
					<ProductRatingSummary summary={summary} />

					<ul className={styles.list}>
						{reviews.content.map((review) => (
							<li key={review.reviewId}>
								<ReviewCard review={review} />
							</li>
						))}
					</ul>
				</div>
			)}
		</Card>
	);
}

type ReviewCardProps = {
	review: ReviewPage["content"][number];
};

function ReviewCard({ review }: ReviewCardProps) {
	const date = formatDate(review.createdAt);

	return (
		<Card className={styles.reviewCard} variant="borderless">
			<div className={styles.reviewHead}>
				<div className={styles.reviewIdentity}>
					<Rate
						className={styles.reviewStars}
						value={review.rating}
						disabled
						aria-label={`${review.rating} out of 5 stars`}
					/>
					<p className={styles.reviewer}>
						{review.customerName?.trim() || "Customer"}
					</p>
				</div>

				<div className={styles.reviewMeta}>
					{review.verifiedPurchase && (
						<Tag className={styles.verifiedTag}>Verified purchase</Tag>
					)}
					{date && <time className={styles.date}>{date}</time>}
				</div>
			</div>

			<p className={styles.comment}>{review.comment}</p>
		</Card>
	);
}
