"use client";

import type { VariantDetail } from "../../types";
import { formatVndPrice } from "../model/product-format";
import { stockLabel, variantSoldOut } from "../model/product-stock";
import { CheckCircleIcon } from "./product-detail-icons";

import styles from "./product-variant-selector.module.css";

type ProductVariantSelectorProps = {
	variants: VariantDetail[];
	selectedVariantId: string;
	/** Called with the chosen `variantId`; the parent owns the selection. */
	onSelect: (variantId: string) => void;
	/** Retained for callers that also render product imagery; unused here. */
	productName?: string;
};

/**
 * The variant cards from the reference design.
 *
 * Each card reads attribute name over attribute value (the established
 * storefront convention) and falls back to "Default" when a variant carries
 * no attributes — never the SKU. Price and stock sit on the bottom row, with
 * the selected card marked by both a teal border and a check icon (not
 * colour alone).
 */
export function ProductVariantSelector({
	variants,
	selectedVariantId,
	onSelect,
}: ProductVariantSelectorProps) {
	return (
		<div className={styles.cards}>
			{variants.map((variant) => {
				const isSelected = variant.variantId === selectedVariantId;
				const soldOut = variantSoldOut(variant);
				// shortcut: only the first attribute is shown, revisit if
				// variants ever carry more than one.
				const attribute = variant.attributes[0];

				return (
					<button
						key={variant.variantId}
						type="button"
						className={
							isSelected
								? `${styles.card} ${styles.cardSelected}`
								: styles.card
						}
						aria-pressed={isSelected}
						onClick={() => onSelect(variant.variantId)}
					>
						<span className={styles.cardHead}>
							<span className={styles.cardName}>
								{attribute?.attributeName ?? "Default"}
							</span>
							{isSelected ? (
								<CheckCircleIcon
									className={styles.check}
									size={16}
								/>
							) : (
								<span
									className={styles.unselectedDot}
									aria-hidden="true"
								/>
							)}
						</span>

						{attribute && (
							<span className={styles.cardValue}>
								{attribute.attributeValue}
							</span>
						)}

						<span className={styles.cardFoot}>
							<span className={styles.cardPrice}>
								{formatVndPrice(variant.price)}
							</span>
							<span
								className={
									soldOut
										? `${styles.cardStock} ${styles.cardStockOut}`
										: styles.cardStock
								}
							>
								<span
									className={styles.stockDot}
									aria-hidden="true"
								/>
								{stockLabel(variant.stock)}
							</span>
						</span>
					</button>
				);
			})}
		</div>
	);
}
