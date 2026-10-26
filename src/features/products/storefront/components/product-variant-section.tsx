"use client";

import { useState } from "react";

import type { Product, VariantDetail } from "../../types";
import { ProductPurchasePanel } from "./product-purchase-panel";
import { ProductVariantGallery } from "./product-variant-gallery";
import { ProductVariantInfo } from "./product-variant-info";
import { ProductVariantSelector } from "./product-variant-selector";

import styles from "./product-variant-section.module.css";

type ProductVariantSectionProps = {
	product: Product;
	variants: VariantDetail[];
};

/**
 * Owns the **selected variant** state and composes criteria §1.1 (the
 * selector carousel) and §2 (image, information card, purchase subsection)
 * around it, so a selection updates everything downstream in one place.
 *
 * The server-renderable pieces stay presentational and receive the chosen
 * `VariantDetail` as a prop — no client refetch of server-owned data.
 */
export function ProductVariantSection({
	product,
	variants,
}: ProductVariantSectionProps) {
	const [selectedVariantId, setSelectedVariantId] = useState(
		variants[0]?.variantId ?? "",
	);

	const selected =
		variants.find(
			(variant) => variant.variantId === selectedVariantId,
		) ?? variants[0];

	if (!selected) {
		return (
			<section className={styles.root} aria-label="Variant details">
				<p className={styles.noVariants}>
					This product has no purchasable variants yet.
				</p>
			</section>
		);
	}

	return (
		<section className={styles.root} aria-label="Variant details">
			<ProductVariantSelector
				variants={variants}
				selectedVariantId={selected.variantId}
				onSelect={setSelectedVariantId}
				productName={product.name}
			/>

			<div className={styles.detail}>
				<div className={styles.gallery}>
					<ProductVariantGallery
						key={selected.variantId}
						variant={selected}
						productName={product.name}
					/>
				</div>

				<div className={styles.info}>
					<ProductVariantInfo variant={selected} />
					{/* Keyed so quantity/notice state resets per variant instead of
					    being resynchronised through effects. */}
					<ProductPurchasePanel
						key={selected.variantId}
						variant={selected}
					/>
				</div>
			</div>
		</section>
	);
}
