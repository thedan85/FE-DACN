import Image from "next/image";
import Link from "next/link";
import { Card, Tag } from "antd";

import type { Product } from "../../types";
import { formatPriceRange } from "../model/product-format";
import styles from "./product-card.module.css";

type ProductCardProps = {
	product: Product;
	/**
	 * Listing-level stock signal.
	 *
	 * `ProductResponse` does not expose stock yet (defect N2). Until the
	 * backend DTO gains the field, this stays `null` and no out-of-stock
	 * treatment is rendered. When the field lands, wire it here
	 * (`inStock={product.inStock}`) without touching the card internals.
	 */
	inStock?: boolean | null;
};

/**
 * Listing card — antd `Card` (equal widths come from the `Row`/`Col` grid
 * in `product-grid`; the card itself is block-level and fills its column).
 * Hover = bounce up (D10-③).
 */
export function ProductCard({ product, inStock = null }: ProductCardProps) {
	const price = formatPriceRange(product.minPrice, product.maxPrice);
	const isOutOfStock = inStock === false;

	return (
		<Card
			className={isOutOfStock ? `${styles.card} ${styles.outOfStock}` : styles.card}
			styles={{
				body: { flex: 1, display: "flex", flexDirection: "column", gap: 8 },
			}}
			cover={
				<div className={styles.imageBox}>
					{product.thumbnail ? (
						<Image
							src={product.thumbnail}
							alt={product.name}
							fill
							sizes="(max-width: 767px) 100vw, (max-width: 991px) 45vw, 300px"
							className={styles.image}
						/>
					) : (
						<span className={styles.placeholder} aria-hidden="true">
							<svg
								width="32"
								height="32"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<rect x="3" y="5" width="18" height="14" rx="2" />
								<circle cx="8.5" cy="9.5" r="1.5" />
								<path d="M3 16.5 8.5 12l4 3.5L16 12l5 4.5" />
							</svg>
						</span>
					)}

					{isOutOfStock && (
						<Tag className={styles.stockTag}>Out of stock</Tag>
					)}
				</div>
			}
		>
			{product.categoryName && (
				<Tag className={styles.badge}>{product.categoryName}</Tag>
			)}

			<h3 className={styles.name}>
				<Link href={`/products/${product.slug}`} className={styles.nameLink}>
					{product.name}
				</Link>
			</h3>

			<p className={price ? styles.price : styles.priceUnavailable}>
				{price ?? "Price unavailable"}
			</p>
		</Card>
	);
}
