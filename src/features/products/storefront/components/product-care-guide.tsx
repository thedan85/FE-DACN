import { splitParagraphs } from "../model/product-format";

import styles from "./product-care-guide.module.css";

type ProductCareGuideProps = {
	detailDescription: string | null | undefined;
};

type GuideParagraph = {
	label: string | null;
	text: string;
};

/**
 * Splits the backend's plain-text care guide at the first short "Label:"
 * prefix, so "Feeding Tips: …" renders with its label emphasised while an
 * ordinary paragraph stays plain. No markup is parsed or injected.
 */
function toGuideParagraph(paragraph: string): GuideParagraph {
	const colon = paragraph.indexOf(":");

	if (colon > 0 && colon <= 48) {
		return {
			label: paragraph.slice(0, colon).trim(),
			text: paragraph.slice(colon + 1).trim(),
		};
	}

	return { label: null, text: paragraph };
}

/**
 * The care guide card: the first line of `detailDescription` is the design's
 * card heading ("Scarlet Badis Care Guide"); the remaining lines are the
 * intro and the labelled care points.
 */
export function ProductCareGuide({
	detailDescription,
}: ProductCareGuideProps) {
	const [heading, ...body] = splitParagraphs(detailDescription);

	if (!heading) {
		return null;
	}

	return (
		<section className={styles.root} aria-labelledby="care-guide-heading">
			<h2 id="care-guide-heading" className={styles.heading}>
				{heading}
			</h2>

			<div className={styles.body}>
				{body.map((paragraph, index) => {
					const { label, text } = toGuideParagraph(paragraph);

					return (
						<p
							key={`${index}-${text.slice(0, 24)}`}
							className={
								label ? styles.point : styles.paragraph
							}
						>
							{label && (
								<span
									className={styles.bullet}
									aria-hidden="true"
								>
									•
								</span>
							)}
							<span>
								{label && (
									<strong className={styles.label}>
										{label}:{" "}
									</strong>
								)}
								{text}
							</span>
						</p>
					);
				})}
			</div>
		</section>
	);
}
