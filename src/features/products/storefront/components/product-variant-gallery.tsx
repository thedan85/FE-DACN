"use client";

import { useState } from "react";
import Image from "next/image";

import { MediaPlaceholder } from "@/components/ui/media-placeholder";

import type { VariantDetail } from "../../types";

import styles from "./product-variant-gallery.module.css";

type ProductVariantGalleryProps = {
	variant: VariantDetail;
	/** Used as the alt text — the image shows the whole product. */
	productName: string;
};

/**
 * Section 2 — the selected variant's main image plus a thumbnail strip when
 * there is more than one (criteria §2).
 *
 * Decision D17: a variant with no media renders the shared
 * `MediaPlaceholder`, and so does an image that **fails to load** — never
 * the product thumbnail. Both cases look identical on purpose, so a broken
 * image never reads as an error state.
 *
 * Soft-deleted media rows (`deleted: true`) are dropped: the aggregate's
 * variant-media query does not filter them.
 */
export function ProductVariantGallery({
	variant,
	productName,
}: ProductVariantGalleryProps) {
	const images = variant.media
		.filter((media) => !media.deleted && media.url)
		.map((media) => media.url);

	const [activeIndex, setActiveIndex] = useState(0);
	const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set());

	const activeUrl = images[activeIndex];
	const activeFailed = activeUrl != null && failed.has(activeIndex);

	function markFailed(index: number) {
		setFailed((previous) => new Set(previous).add(index));
	}

	return (
		<div className={styles.root}>
			<div className={styles.main}>
				{activeUrl != null && !activeFailed ? (
					<Image
						key={activeUrl}
						src={activeUrl}
						alt={productName}
						fill
						sizes="(max-width: 991px) 100vw, 45vw"
						className={styles.image}
						onError={() => markFailed(activeIndex)}
					/>
				) : (
					<MediaPlaceholder
						className={styles.placeholder}
						text={
							images.length === 0
								? "No image available"
								: "Image unavailable"
						}
					/>
				)}
			</div>

			{images.length > 1 && (
				<ul className={styles.thumbs}>
					{images.map((url, index) => {
						const isActive = index === activeIndex;
						const hasFailed = failed.has(index);

						return (
							<li key={url}>
								<button
									type="button"
									className={
										isActive
											? `${styles.thumb} ${styles.thumbActive}`
											: styles.thumb
									}
									aria-pressed={isActive}
									aria-label={`Show image ${index + 1} of ${images.length}`}
									onClick={() => setActiveIndex(index)}
								>
									{hasFailed ? (
										<MediaPlaceholder
											className={styles.thumbPlaceholder}
											label=""
										/>
									) : (
										<Image
											src={url}
											alt=""
											fill
											sizes="72px"
											className={styles.image}
											onError={() => markFailed(index)}
										/>
									)}
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
