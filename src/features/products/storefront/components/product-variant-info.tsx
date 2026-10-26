"use client";

// Client-only for the same reason as `product-info-card`: `@ant-design/icons`
// has no "use client" banner and cannot be evaluated in a Server Component.
import {
	CodeOutlined,
	DatabaseOutlined,
	TagOutlined,
} from "@ant-design/icons";
import { Card, Tag } from "antd";

import type { VariantDetail } from "../../types";
import { formatVndPrice } from "../model/product-format";
import { stockLabel } from "../model/product-stock";

/**
 * Row styles are shared with Section 1 on purpose — the criteria ask for
 * the same "icon + label + value" anatomy in both cards.
 */
import rows from "./product-info-card.module.css";
import styles from "./product-variant-info.module.css";

type ProductVariantInfoProps = {
	variant: VariantDetail;
};

/**
 * Section 2 — the selected variant's SKU, stock status and price as one
 * card, plus a nested card of `name: value` attribute tags. The attribute
 * card is hidden entirely when the variant has none (criteria §2).
 */
export function ProductVariantInfo({ variant }: ProductVariantInfoProps) {
	return (
		<Card
			className={rows.card}
			title={<p className={rows.cardHeader}>Variant information</p>}
		>
			<dl className={rows.fields}>
				<div className={rows.field}>
					<dt className={rows.label}>
						<CodeOutlined className={rows.icon} />
						SKU
					</dt>
					<dd className={rows.value}>{variant.sku}</dd>
				</div>

				<div className={rows.field}>
					<dt className={rows.label}>
						<DatabaseOutlined className={rows.icon} />
						Stock
					</dt>
					<dd
						className={
							variant.stock > 0 ? rows.value : rows.valueMuted
						}
					>
						{stockLabel(variant.stock)}
					</dd>
				</div>

				<div className={rows.field}>
					<dt className={rows.label}>
						<TagOutlined className={rows.icon} />
						Price
					</dt>
					<dd className={rows.value}>
						{formatVndPrice(variant.price)}
					</dd>
				</div>
			</dl>

			{variant.attributes.length > 0 && (
				<section
					className={styles.attributes}
					aria-label="Variant attributes"
				>
					<h3 className={styles.attributesHeader}>Attributes</h3>
					<div className={styles.tags}>
						{variant.attributes.map((attribute) => (
							<Tag
								key={attribute.variantValueId}
								className={styles.tag}
							>
								<span className={styles.tagLabel}>
									{attribute.attributeName}:
								</span>{" "}
								{attribute.attributeValue}
							</Tag>
						))}
					</div>
				</section>
			)}
		</Card>
	);
}
