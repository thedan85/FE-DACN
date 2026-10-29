import { EmptyState } from "@/components/feedback/empty-state";

import type { ReviewPage } from "../../types";
import { formatDate } from "../model/product-format";
import { summarizeReviews } from "../model/review-summary";
import { BadgeCheckIcon } from "./product-detail-icons";
import { ProductRatingSummary } from "./product-rating-summary";
import { RatingStars } from "./rating-stars";

import styles from "./product-reviews.module.css";

type ProductReviewsProps = {
	/** The aggregate's `reviews` page (default size 20, backend cap 100). */
	reviews: ReviewPage;
};

/**
 * Customer Reviews — the 340px score card beside the review cards, matching
 * the reference layout.
 *
 * Fully implemented with an honest empty state (decision D15): the score
 * block is hidden and the panel says "No reviews yet" rather than inventing
 * numbers. Reviewer names come from `customerName`; a missing name degrades
 * to a neutral label, never to an opaque id. The "Verified" pill appears only
 * when the backend says the review is tied to a purchase.
 */
export function ProductReviews({ reviews }: ProductReviewsProps) {
	const summary = summarizeReviews(reviews);

	return (
		<section className={styles.root} aria-labelledby="reviews-heading">
			<h2 id="reviews-heading" className={styles.heading}>
				Customer Reviews
			</h2>

			{summary.total === 0 ? (
				<div className={styles.empty}>
					<EmptyState description="No reviews yet" />
				</div>
			) : (
				<div className={styles.split}>
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
		</section>
	);
}

type ReviewCardProps = {
	review: ReviewPage["content"][number];
};

function ReviewCard({ review }: ReviewCardProps) {
	const date = formatDate(review.createdAt);

	return (
		<article className={styles.card}>
			<header className={styles.cardHead}>
				<div className={styles.identity}>
					<div className={styles.nameRow}>
						<p className={styles.reviewer}>
							{review.customerName?.trim() || "Customer"}
						</p>
						{review.verifiedPurchase && (
							<span className={styles.verified}>
								<BadgeCheckIcon size={10} />
								Verified
							</span>
						)}
					</div>
					<RatingStars value={review.rating} />
				</div>

				{date && (
					<time className={styles.date} dateTime={review.createdAt}>
						{date}
					</time>
				)}
			</header>

			<p className={styles.comment}>{review.comment}</p>
		</article>
	);
}
