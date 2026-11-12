"use client";

import { useCallback, useRef, useState } from "react";
import { Button, Flex, Select, Typography } from "antd";

import type { Attribute, AttributeValue } from "@/features/products/types";

import { listAttributeValues } from "../api/attributes.api";
import { apiErrorMessage } from "../model/api-error";
import {
	attributeOptions,
	resolveAddBlock,
	valueOptions,
	type AttributeLink,
} from "../model/product-attributes";

const { Text } = Typography;

type AttributePickerProps = {
	/**
	 * The product's (or variant's) existing links, so taken attributes are known.
	 * Typed structurally, so `productValueId` and `variantValueId` rows both fit.
	 */
	links: readonly AttributeLink[];
	attributes: Attribute[];
	/** Disables every control (no permission, or a request in flight). */
	disabled?: boolean;
	/**
	 * Called with the chosen pair. The caller performs the write, because the
	 * endpoint differs between products and variants, and reports whether it
	 * succeeded — the picker keeps the selection on failure so a retry does not
	 * need re-picking.
	 */
	onAdd: (attributeId: string, attributeValueId: string) => Promise<boolean>;
};

/**
 * Two-step attribute picker: choose an attribute, then one of its values.
 *
 * Values load **in the change handler**, not an effect: the user's selection is
 * the event, so fetching there avoids a synchronous `setState` inside an effect
 * (which React 19 flags) and cannot fire for an attribute the user never chose.
 *
 * Values load per attribute rather than up front — 68 values across 12
 * attributes would be a slow first render and a worse interface. Each fetched
 * set is cached for the life of the picker, so re-opening a select is instant.
 *
 * Attributes that already carry a value are shown but disabled, with the reason
 * in the label: the backend allows one value per attribute and answers 409
 * otherwise (verified live), so offering a second would guarantee a failure.
 *
 * Shared with the variant editor (ticket 07); only `onAdd` differs.
 */
export function AttributePicker({
	links,
	attributes,
	disabled = false,
	onAdd,
}: AttributePickerProps) {
	const [attributeId, setAttributeId] = useState<string | null>(null);
	const [attributeValueId, setAttributeValueId] = useState<string | null>(null);
	const [values, setValues] = useState<AttributeValue[]>([]);
	const [valuesLoading, setValuesLoading] = useState(false);
	const [valuesError, setValuesError] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	/** Values already fetched, keyed by attribute, so switching back is instant. */
	const [cache, setCache] = useState<Record<string, AttributeValue[]>>({});
	/** Guards against a slow response for a previously selected attribute. */
	const requestToken = useRef(0);

	const loadValues = useCallback(
		async (nextAttributeId: string) => {
			const cached = cache[nextAttributeId];

			if (cached !== undefined) {
				setValues(cached);
				setValuesError(null);
				return;
			}

			// `selectAttribute` already bumped the token for this selection; reading
			// it now is what marks this request as the current one.
			const token = requestToken.current;
			setValuesLoading(true);
			setValuesError(null);

			try {
				const result = await listAttributeValues(nextAttributeId);

				// A slower request for an attribute the user has since moved away
				// from must not overwrite the current one's values.
				if (token !== requestToken.current) {
					return;
				}

				setValues(result);
				setCache((previous) => ({ ...previous, [nextAttributeId]: result }));
			} catch (caught) {
				if (token !== requestToken.current) {
					return;
				}

				setValues([]);
				setValuesError(
					apiErrorMessage(caught, "Could not load this attribute's values."),
				);
			} finally {
				if (token === requestToken.current) {
					setValuesLoading(false);
				}
			}
		},
		[cache],
	);

	// Changing the attribute clears the chosen value: a value id belongs to one
	// attribute, so keeping it would submit a pair that cannot be valid.
	function selectAttribute(next: string | null) {
		// Bump before anything else: a request for the previous attribute is now
		// stale whatever happens next, including a cache hit or a cleared
		// selection. Without this, a slow response could render values (or an
		// error) for an attribute the user is no longer looking at.
		requestToken.current += 1;
		setValuesLoading(false);
		setValuesError(null);
		setAttributeId(next);
		setAttributeValueId(null);
		setValues([]);

		if (next !== null) {
			void loadValues(next);
		}
	}

	const blockReason = resolveAddBlock(links, attributeId, attributeValueId);
	const canAdd = blockReason === null && !adding && !disabled;

	async function handleAdd() {
		if (attributeId === null || attributeValueId === null) {
			return;
		}

		setAdding(true);

		try {
			const added = await onAdd(attributeId, attributeValueId);

			// Reset only on success: a failure keeps the selection so the user can
			// retry without re-picking.
			if (added) {
				setAttributeId(null);
				setAttributeValueId(null);
				setValues([]);
			}
		} finally {
			setAdding(false);
		}
	}

	return (
		<Flex vertical gap={8}>
			<Flex gap={8} wrap>
				<Select
					aria-label="Attribute"
					placeholder="Choose an attribute"
					value={attributeId}
					options={attributeOptions(attributes, links)}
					onChange={selectAttribute}
					disabled={disabled || adding}
					showSearch={{ optionFilterProp: "label" }}
					style={{ minWidth: 200, flex: 1 }}
				/>
				<Select
					aria-label="Attribute value"
					placeholder={
						attributeId === null ? "Pick an attribute first" : "Choose a value"
					}
					value={attributeValueId}
					options={valueOptions(values)}
					onChange={setAttributeValueId}
					disabled={disabled || adding || attributeId === null || valuesLoading}
					loading={valuesLoading}
					showSearch={{ optionFilterProp: "label" }}
					style={{ minWidth: 180, flex: 1 }}
				/>
				<Button onClick={() => void handleAdd()} disabled={!canAdd} loading={adding}>
					Add
				</Button>
			</Flex>

			{valuesError !== null && (
				<Text type="danger" role="alert">
					{valuesError}
				</Text>
			)}

			{/* The reason is shown rather than only disabling the button, so a
			    blocked Add explains itself instead of looking broken. */}
			{blockReason !== null &&
				!disabled &&
				(attributeId !== null || attributeValueId !== null) && (
					<Text type="secondary">{blockReason}</Text>
				)}
		</Flex>
	);
}
