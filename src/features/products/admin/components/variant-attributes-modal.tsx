"use client";

import { useState } from "react";
import { App, Flex, Modal, Typography } from "antd";

import type { VariantAttributeValue } from "@/features/products/types";

import {
	addVariantAttribute,
	removeVariantAttribute,
} from "../api/attributes.api";
import { apiErrorMessage } from "../model/api-error";
import { variantLabel, type VariantRow } from "../model/variants";
import { useAttributeCatalog } from "../use-attribute-catalog";
import { AttributeLinkList } from "./attribute-link-list";
import { AttributePicker } from "./attribute-picker";

const { Text } = Typography;

type VariantAttributesModalProps = {
	/** The row being edited, or `null` when the dialog is closed. */
	variant: VariantRow | null;
	open: boolean;
	mayAdd: boolean;
	mayDelete: boolean;
	onClose: () => void;
	/**
	 * Called with the variant's new link list after each write. Only the picks are
	 * reported — the row's SKU, price and stock are the inline editor's business,
	 * and a concurrent PATCH may have changed them since this dialog opened.
	 */
	onAttributesChanged: (
		variantId: string,
		attributes: VariantRow["attributes"],
	) => void;
};

/**
 * One variant's attribute picks.
 *
 * A variant holds **at most one value per attribute** — `variantValueId` is
 * `{variantId}-{attributeId}` and a second value is a 409 — so the shared
 * `AttributePicker` disables attributes that are already set and says why
 * (ticket 06's rule, verified live for variants too).
 *
 * Adds and removes are immediate: each link is its own resource, so there is
 * nothing to stage. The twelve-attribute catalogue comes from the shared
 * `useAttributeCatalog`, fetched only while this dialog is open and cached for
 * the page, so the product's attributes card and this dialog never both ask.
 */
export function VariantAttributesModal({
	variant,
	open,
	mayAdd,
	mayDelete,
	onClose,
	onAttributesChanged,
}: VariantAttributesModalProps) {
	return (
		<Modal
			title={variant === null ? "Variant attributes" : `Attributes · ${variant.sku}`}
			open={open}
			onCancel={onClose}
			footer={null}
			// Unmounting on close resets the picker, so a half-made selection does
			// not greet the next row's dialog.
			destroyOnHidden
			width={560}
		>
			{open && variant !== null && (
				<VariantAttributesDialog
					variant={variant}
					mayAdd={mayAdd}
					mayDelete={mayDelete}
					onAttributesChanged={onAttributesChanged}
				/>
			)}
		</Modal>
	);
}

type VariantAttributesDialogProps = {
	variant: VariantRow;
	mayAdd: boolean;
	mayDelete: boolean;
	onAttributesChanged: (
		variantId: string,
		attributes: VariantRow["attributes"],
	) => void;
};

/** The dialog's contents, mounted only while it is open. */
function VariantAttributesDialog({
	variant,
	mayAdd,
	mayDelete,
	onAttributesChanged,
}: VariantAttributesDialogProps) {
	const { message } = App.useApp();
	const catalog = useAttributeCatalog();
	const [removingId, setRemovingId] = useState<string | null>(null);

	// While a link is being removed its row must not also be edited, so the
	// picker is held until the server answers.
	const busy = removingId !== null;

	async function handleAdd(
		attributeId: string,
		attributeValueId: string,
	): Promise<boolean> {
		try {
			const created = await addVariantAttribute({
				variantId: variant.variantId,
				attributeId,
				attributeValueId,
			});

			onAttributesChanged(variant.variantId, [
				...variant.attributes,
				created,
			]);
			return true;
		} catch (caught) {
			// A 409 means the server already has a value for this attribute, which
			// the picker normally prevents. Report it once and return `false` so the
			// picker keeps the selection for a retry instead of rethrowing into a
			// fire-and-forget handler.
			message.error(
				apiErrorMessage(
					caught,
					"Could not add that attribute. Please try again.",
				),
			);
			return false;
		}
	}

	async function handleRemove(link: VariantAttributeValue): Promise<void> {
		setRemovingId(link.variantValueId);

		try {
			await removeVariantAttribute(link.variantValueId);
			onAttributesChanged(
				variant.variantId,
				variant.attributes.filter(
					(item) => item.variantValueId !== link.variantValueId,
				),
			);
		} catch (caught) {
			message.error(
				apiErrorMessage(
					caught,
					"Could not remove that attribute. Please try again.",
				),
			);
		} finally {
			setRemovingId(null);
		}
	}

	return (
		<Flex vertical gap={16}>
			<Text type="secondary">
				{`${variantLabel(variant)} — a variant holds one value per attribute, so an attribute already set must be removed before it can change.`}
			</Text>

			{catalog.status === "failed" ? (
				<Text type="danger" role="alert">
					Could not load the attribute list. The row&apos;s existing picks can
					still be removed below.
				</Text>
			) : (
				mayAdd && (
					<AttributePicker
						links={variant.attributes}
						attributes={catalog.status === "ready" ? catalog.attributes : []}
						disabled={catalog.status !== "ready" || busy}
						onAdd={handleAdd}
					/>
				)
			)}

			<AttributeLinkList
				links={variant.attributes}
				mayDelete={mayDelete}
				removingId={removingId}
				rowKey={(link) => link.variantValueId}
				onRemove={handleRemove}
				emptyDescription="No attributes on this variant yet"
			/>
		</Flex>
	);
}
