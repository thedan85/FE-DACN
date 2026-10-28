import { Card } from "antd";

import { splitParagraphs } from "../model/product-format";

import styles from "./product-description-card.module.css";

type ProductDescriptionCardProps = {
	/** Raw `detailDescription` from the aggregate (plain text, D19). */
	detailDescription: string;
};

/**
 * Section 3 — header + the product's detailed description.
 *
 * Plain paragraphs only: the backend stores `\r\n`-separated text and the
 * team decided against rich-text rendering (decision D19), so no markup is
 * ever parsed or injected. The body scrolls once it exceeds the available
 * height, and the scroller is keyboard-reachable (WCAG 2.1.1).
 */
export function ProductDescriptionCard({
	detailDescription,
}: ProductDescriptionCardProps) {
	const paragraphs = splitParagraphs(detailDescription);

	return (
		<Card
			className={styles.card}
			title={<h2 className={styles.header}>Detailed description</h2>}
		>
			{paragraphs.length > 0 ? (
				<div
					className={styles.scroller}
					tabIndex={0}
					role="region"
					aria-label="Detailed description"
				>
					{paragraphs.map((paragraph, index) => (
						<p key={index} className={styles.paragraph}>
							{paragraph}
						</p>
					))}
				</div>
			) : (
				<p className={styles.empty}>
					No detailed description available for this product yet.
				</p>
			)}
		</Card>
	);
}
