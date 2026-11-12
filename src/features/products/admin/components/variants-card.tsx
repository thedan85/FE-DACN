"use client";

import { useState } from "react";
import { Button, Card, Flex, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";

import { CATALOG_PERMISSIONS } from "../model/permissions";
import {
	totalVariantStock,
	type VariantImage,
	type VariantRow,
	type VariantRowValues,
} from "../model/variants";
import { useCatalogPermissions } from "../use-catalog-permissions";
import { VariantAttributesModal } from "./variant-attributes-modal";
import { VariantCreateModal } from "./variant-create-modal";
import { VariantsTable } from "./variants-table";
import styles from "./variants-card.module.css";

const { Text } = Typography;

type VariantsCardProps = {
	productId: string;
	/**
	 * The rows on screen. Owned by the page so the header's SKU and this card's
	 * stock total are the same numbers; every change is reported back rather
	 * than kept in a second copy here.
	 */
	variants: VariantRow[];
	onVariantAdded: (row: VariantRow) => void;
	/**
	 * The three fields a `VariantResponse` can describe. Reported separately from
	 * the picks because the response carries no attributes: merging the whole
	 * row would revert picks added while the PATCH was in flight.
	 */
	onVariantFieldsSaved: (variantId: string, fields: VariantRowValues) => void;
	onVariantAttributesChanged: (
		variantId: string,
		attributes: VariantRow["attributes"],
	) => void;
	/** Reported with just the new image, so a concurrent row edit survives. */
	onVariantImageAdded: (variantId: string, image: VariantImage) => void;
	onVariantRemoved: (variantId: string) => void;
};

/**
 * The product's variants: a row per variant, each edited and saved on its own
 * (ADR-0003).
 *
 * This is the card's shell — heading, the add action, the stock summary and the
 * two dialogs. The rows themselves live in `VariantsTable`, which owns the
 * per-row edit state; the card only decides what is offered and reports the
 * server's answers upward.
 *
 * Nothing here is part of the product form's save: every control writes its own
 * resource immediately, which is why the card sits outside the save bar.
 */
export function VariantsCard({
	productId,
	variants,
	onVariantAdded,
	onVariantFieldsSaved,
	onVariantAttributesChanged,
	onVariantImageAdded,
	onVariantRemoved,
}: VariantsCardProps) {
	const { can } = useCatalogPermissions();

	const [createOpen, setCreateOpen] = useState(false);
	const [attributesFor, setAttributesFor] = useState<string | null>(null);

	const mayUpdate = can(CATALOG_PERMISSIONS.variantUpdate);
	const mayCreate = can(CATALOG_PERMISSIONS.variantCreate);
	const mayDelete = can(CATALOG_PERMISSIONS.variantDelete);
	// Variant images are uploaded through `/uploads/variants/{id}`, which the
	// backend gates on `media:create` — not on any variant code.
	const mayUploadImage = can(CATALOG_PERMISSIONS.mediaCreate);

	if (!mayUpdate) {
		// The ticket's gate: without `variant:update` the whole card is hidden,
		// because every control in it writes through that permission.
		return null;
	}

	const total = totalVariantStock(variants);
	const attributesVariant =
		variants.find((variant) => variant.variantId === attributesFor) ?? null;

	return (
		<Card
			title="Variants"
			extra={
				<Text type="secondary" className={styles.help}>
					{variants.length === 1 ? "1 variant" : `${variants.length} variants`} ·
					each edit saves immediately
				</Text>
			}
		>
			<VariantsTable
				rows={variants}
				mayDelete={mayDelete}
				mayUploadImage={mayUploadImage}
				onFieldsSaved={onVariantFieldsSaved}
				onRemoved={onVariantRemoved}
				onEditAttributes={setAttributesFor}
				onImageAdded={onVariantImageAdded}
			/>

			{mayCreate && (
				<Button
					icon={<PlusOutlined />}
					onClick={() => setCreateOpen(true)}
					className={styles.addRow}
				>
					Add variant
				</Button>
			)}

			<Flex
				align="center"
				justify="space-between"
				gap={12}
				className={styles.footer}
			>
				<Flex vertical gap={2}>
					<Text>Total available stock</Text>
					{/* Labelled as a sum of the rows on screen: the product's own stock
					    is derived server-side and only catches up on the next read. */}
					<Text type="secondary" className={styles.sumNote}>
						Sum of the {variants.length}{" "}
						{variants.length === 1 ? "row" : "rows"} above.
					</Text>
				</Flex>
				<Text strong className={styles.total}>
					{total} {total === 1 ? "unit" : "units"}
				</Text>
			</Flex>

			<VariantCreateModal
				productId={productId}
				open={createOpen}
				onCancel={() => setCreateOpen(false)}
				onCreated={onVariantAdded}
			/>

			<VariantAttributesModal
				variant={attributesVariant}
				open={attributesVariant !== null}
				// A variant's attribute links are gated on `variant:*`, not
				// `attribute:*`: the backend's `@PreAuthorize` on `/variant-attributes`
				// is `VARIANT_CREATE` / `VARIANT_DELETE`, unlike `/product-attributes`
				// (which uses `ATTRIBUTE_CREATE` / `ATTRIBUTE_DELETE`). Reusing the
				// variant codes here is deliberate, not a copy-paste slip.
				mayAdd={mayCreate}
				mayDelete={mayDelete}
				onClose={() => setAttributesFor(null)}
				onAttributesChanged={onVariantAttributesChanged}
			/>
		</Card>
	);
}
