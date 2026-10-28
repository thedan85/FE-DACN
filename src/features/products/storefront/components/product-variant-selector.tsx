"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button } from "antd";

import { MediaPlaceholder } from "@/components/ui/media-placeholder";

import type { VariantDetail } from "../../types";
import { formatVndPrice } from "../model/product-format";
import { stockLabel, variantSoldOut } from "../model/product-stock";

import styles from "./product-variant-selector.module.css";

type ProductVariantSelectorProps = {
	variants: VariantDetail[];
	selectedVariantId: string;
	/** Called with the chosen `variantId`; the parent owns the selection. */
	onSelect: (variantId: string) => void;
	productName: string;
};

function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

/**
 * Section 1.1 — the variant selector carousel (criteria §1.1).
 *
 * A native horizontal, scroll-snap scroller with arrow buttons that wrap
 * around in both directions, so stepping left/right never runs out
 * ("infinite" navigation) instead of duplicating the track — with 2–3
 * variants a duplicated track can be wider than the viewport, which breaks
 * the seam-jump technique it relies on.
 *
 * Each slide shows the variant's **first** media image (`media[0]`) or,
 * when the variant has none (or that image fails to load), the shared
 * `MediaPlaceholder` — **never** the product thumbnail (decision D17).
 *
 * Selection is click/keyboard driven; scrolling alone never changes it.
 */
export function ProductVariantSelector({
	variants,
	selectedVariantId,
	onSelect,
	productName,
}: ProductVariantSelectorProps) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLUListElement>(null);
	const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set());

	const selectedIndex = Math.max(
		variants.findIndex(
			(variant) => variant.variantId === selectedVariantId,
		),
		0,
	);
	const showArrows = variants.length > 1;

	function markFailed(index: number) {
		setFailed((previous) => new Set(previous).add(index));
	}

	function scrollToIndex(index: number) {
		const track = trackRef.current;
		const item = track?.children[index] as HTMLElement | undefined;

		if (!track || !item) {
			return;
		}

		viewportRef.current?.scrollTo({
			left: item.offsetLeft,
			behavior: prefersReducedMotion() ? "auto" : "smooth",
		});
	}

	function selectIndex(index: number) {
		const bounded = (index + variants.length) % variants.length;
		onSelect(variants[bounded].variantId);
		scrollToIndex(bounded);
	}

	function handleTrackKeyDown(
		event: React.KeyboardEvent<HTMLUListElement>,
	) {
		if (event.key === "ArrowRight") {
			event.preventDefault();
			selectIndex(selectedIndex + 1);
		} else if (event.key === "ArrowLeft") {
			event.preventDefault();
			selectIndex(selectedIndex - 1);
		} else if (event.key === "Home") {
			event.preventDefault();
			selectIndex(0);
		} else if (event.key === "End") {
			event.preventDefault();
			selectIndex(variants.length - 1);
		}
	}

	return (
		<div className={styles.root}>
			<div className={styles.heading}>
				<h2 className={styles.title}>Choose a variant</h2>

				{showArrows && (
					<div className={styles.arrows}>
						<Button
							aria-label="Previous variant"
							icon={<LeftOutlined />}
							onClick={() => selectIndex(selectedIndex - 1)}
						/>
						<Button
							aria-label="Next variant"
							icon={<RightOutlined />}
							onClick={() => selectIndex(selectedIndex + 1)}
						/>
					</div>
				)}
			</div>

			<div className={styles.viewport} ref={viewportRef}>
				<ul
					className={styles.track}
					ref={trackRef}
					role="group"
					aria-label="Choose a variant"
					onKeyDown={handleTrackKeyDown}
				>
					{variants.map((variant, index) => {
						const isSelected =
							variant.variantId === selectedVariantId;
						const imageUrl =
							variant.media.find((media) => !media.deleted && media.url)
								?.url ?? null;
						const imageFailed = failed.has(index);
						const soldOut = variantSoldOut(variant);
						const label = isSelected
							? `${styles.slide} ${styles.slideActive}`
							: styles.slide;

						return (
							<li key={variant.variantId} className={styles.slideItem}>
								<button
									type="button"
									className={label}
									aria-pressed={isSelected}
									onClick={() => selectIndex(index)}
								>
									<span className={styles.slideImage}>
										{imageUrl != null && !imageFailed ? (
											<Image
												src={imageUrl}
												alt={productName}
												fill
												sizes="(max-width: 767px) 60vw, 220px"
												className={styles.image}
												onError={() => markFailed(index)}
											/>
										) : (
											<MediaPlaceholder
												className={styles.slidePlaceholder}
												label=""
											/>
										)}
									</span>

									<span className={styles.slideSku}>
										{variant.sku}
									</span>
									<span className={styles.slidePrice}>
										{formatVndPrice(variant.price)}
									</span>
									<span
										className={
											soldOut
												? `${styles.stock} ${styles.stockOut}`
												: styles.stock
										}
									>
										{stockLabel(variant.stock)}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}
