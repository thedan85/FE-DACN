"use client";

// `@ant-design/icons` ships no "use client" banner, so it must only be
// imported from client modules — in a Server Component it evaluates against
// the react-server React build, where `createContext` does not exist and the
// production build fails at page-data collection.
import {
	CheckCircleOutlined,
	FileTextOutlined,
	FolderOutlined,
	InfoCircleOutlined,
	TagOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { Card, Tag } from "antd";

import type { Product } from "../../types";
import { formatPriceRange } from "../model/product-format";
import { isOutOfStock } from "../model/product-stock";

import styles from "./product-info-card.module.css";

type ProductInfoCardProps = {
	product: Product;
};

/**
 * Section 1 — one card holding an icon + label + value row for each of
 * name, price, description, category and status.
 *
 * Server-renderable: only *direct* antd/icon imports are used, since nested
 * accesses such as `Typography.Text` are undefined in a React Server
 * Component. The product name is this page's single `h1`.
 */
export function ProductInfoCard({ product }: ProductInfoCardProps) {
	const price = formatPriceRange(product.minPrice, product.maxPrice);

	return (
		<Card
			className={styles.card}
			title={<p className={styles.cardHeader}>Product information</p>}
		>
			<dl className={styles.fields}>
				<div className={styles.field}>
					<dt className={styles.label}>
						<InfoCircleOutlined className={styles.icon} />
						Name
					</dt>
					<dd className={styles.value}>
						<h1 className={styles.name}>{product.name}</h1>
					</dd>
				</div>

				<div className={styles.field}>
					<dt className={styles.label}>
						<TagOutlined className={styles.icon} />
						Price
					</dt>
					<dd className={price ? styles.value : styles.valueMuted}>
						{price ?? "Price unavailable"}
						{isOutOfStock(product.stock) && (
							<Tag className={styles.stockTag}>Out of stock</Tag>
						)}
					</dd>
				</div>

				<div className={styles.field}>
					<dt className={styles.label}>
						<FileTextOutlined className={styles.icon} />
						Description
					</dt>
					<dd className={styles.value}>
						{product.description || (
							<span className={styles.valueMuted}>
								No description available.
							</span>
						)}
					</dd>
				</div>

				<div className={styles.field}>
					<dt className={styles.label}>
						<FolderOutlined className={styles.icon} />
						Category
					</dt>
					<dd className={styles.value}>
						{product.categoryId && product.categoryName ? (
							<Link
								className={styles.categoryLink}
								href={`/products?category=${encodeURIComponent(
									product.categoryId,
								)}`}
							>
								{product.categoryName}
							</Link>
						) : (
							<span className={styles.valueMuted}>
								Uncategorised
							</span>
						)}
					</dd>
				</div>

				<div className={styles.field}>
					<dt className={styles.label}>
						<CheckCircleOutlined className={styles.icon} />
						Status
					</dt>
					<dd className={styles.value}>
						<Tag className={styles.statusTag}>
							{statusLabel(product.status)}
						</Tag>
					</dd>
				</div>
			</dl>
		</Card>
	);
}

/** Human label for the backend's `ProductStatus` enum. */
function statusLabel(status: Product["status"]): string {
	switch (status) {
		case "ACTIVE":
			return "Active";
		case "DRAFT":
			return "Draft";
		case "INACTIVE":
			return "Inactive";
		case "DELETED":
			return "Deleted";
	}
}
