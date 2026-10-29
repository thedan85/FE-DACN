import { StarIcon } from "./product-detail-icons";

import styles from "./rating-stars.module.css";

type RatingStarsProps = {
	/** 0–5; the whole-star count is used, matching the design. */
	value: number;
	size?: number;
	className?: string;
};

/**
 * Gold outline stars used in the product header, the review summary and each
 * review card. The exact value stays available to assistive tech through the
 * group label even though the visual is whole stars.
 */
export function RatingStars({
	value,
	size = 16,
	className,
}: RatingStarsProps) {
	const filled = Math.max(0, Math.min(5, Math.floor(value)));
	const classes = [styles.root, className].filter(Boolean).join(" ");

	return (
		<span
			className={classes}
			role="img"
			aria-label={`${value.toFixed(1)} out of 5 stars`}
		>
			{[0, 1, 2, 3, 4].map((index) => (
				<StarIcon
					key={index}
					size={size}
					className={index < filled ? styles.filled : styles.empty}
				/>
			))}
		</span>
	);
}
