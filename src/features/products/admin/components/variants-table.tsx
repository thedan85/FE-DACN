"use client";

import { useState, type ReactNode } from "react";
import {
	App,
	Button,
	Flex,
	Input,
	InputNumber,
	Popconfirm,
	Spin,
	Table,
	Tag,
	Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { DeleteOutlined, SettingOutlined } from "@ant-design/icons";

import { deleteVariant, patchVariant } from "../api/variants.api";
import { apiErrorMessage, isConflict } from "../model/api-error";
import { describeAttributeLink } from "../model/product-attributes";
import {
	buildVariantUpdate,
	validateVariantRow,
	variantFieldsFromRecord,
	variantLabel,
	type VariantRow,
	type VariantRowErrors,
	type VariantRowValues,
} from "../model/variants";
import styles from "./variants-table.module.css";

const { Text } = Typography;

/** What an input shows: the server value, or the user's uncommitted edit. */
type RowDraft = {
	sku: string;
	price: number | null;
	stock: number | null;
};

type VariantsTableProps = {
	rows: VariantRow[];
	mayDelete: boolean;
	/** Reported with only the three fields a `VariantResponse` describes. */
	onFieldsSaved: (variantId: string, fields: VariantRowValues) => void;
	onRemoved: (variantId: string) => void;
	onEditAttributes: (variantId: string) => void;
};

/** The row's current editable values, from the server row. */
function draftFrom(row: VariantRow): RowDraft {
	return { sku: row.sku, price: row.price, stock: row.stock };
}

/**
 * The variant table, with each cell editable in place.
 *
 * **Every row is its own resource, so every edit writes immediately** — a cell
 * commits on blur or Enter, and the row keys its own draft, errors and in-flight
 * flags. Per-row state is not just tidiness: two rows may be saving at once, and
 * a single "busy" flag would silently drop the second row's edit.
 *
 * The write goes through `buildVariantUpdate`, never the product's
 * `buildProductRequest`: `VariantService.replace` is `return update(...)`, so
 * `PUT` and `PATCH` are the same request and there is no method to choose.
 */
export function VariantsTable({
	rows,
	mayDelete,
	onFieldsSaved,
	onRemoved,
	onEditAttributes,
}: VariantsTableProps) {
	const { message } = App.useApp();

	const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
	const [errors, setErrors] = useState<Record<string, VariantRowErrors>>({});
	const [savingIds, setSavingIds] = useState<Record<string, true>>({});
	const [removingIds, setRemovingIds] = useState<Record<string, true>>({});

	function draftFor(row: VariantRow): RowDraft {
		return drafts[row.variantId] ?? draftFrom(row);
	}

	function updateDraft(row: VariantRow, patch: Partial<RowDraft>) {
		setDrafts((previous) => ({
			...previous,
			[row.variantId]: { ...(previous[row.variantId] ?? draftFrom(row)), ...patch },
		}));
	}

	function clearFeedback(variantId: string) {
		setDrafts((previous) => {
			const next = { ...previous };
			delete next[variantId];
			return next;
		});
		setErrors((previous) => {
			if (!(variantId in previous)) {
				return previous;
			}

			const next = { ...previous };
			delete next[variantId];
			return next;
		});
	}

	function setRowErrors(variantId: string, rowErrors: VariantRowErrors) {
		setErrors((previous) => ({ ...previous, [variantId]: rowErrors }));
	}

	/**
	 * Validates, then writes this row's pending edit.
	 *
	 * Validation runs first, so an invalid cell never becomes a request. A 409 is
	 * the one failure only the server can decide; it lands on this row's SKU
	 * field while the typed value stays put.
	 */
	async function commitRow(row: VariantRow) {
		if (savingIds[row.variantId] || removingIds[row.variantId]) {
			return;
		}

		const draft = draftFor(row);
		const candidate: VariantRowValues = {
			sku: draft.sku,
			price: draft.price ?? Number.NaN,
			stock: draft.stock ?? Number.NaN,
		};
		const rowErrors = validateVariantRow(candidate);

		if (Object.keys(rowErrors).length > 0) {
			setRowErrors(row.variantId, rowErrors);
			return;
		}

		const update = buildVariantUpdate(row, candidate);

		if (update === null) {
			// Nothing changed, so a blur is not a save.
			clearFeedback(row.variantId);
			return;
		}

		setRowErrors(row.variantId, {});
		setSavingIds((previous) => ({ ...previous, [row.variantId]: true }));

		try {
			const saved = await patchVariant(row.variantId, update);
			// Only the three fields the response describes; the picks stay as the
			// page holds them, so an attribute added mid-request is not reverted.
			// The row's own stock is the fallback: a null stock in the DTO means
			// "not reported", and reading it as 0 would zero a real level silently.
			onFieldsSaved(
				row.variantId,
				variantFieldsFromRecord(saved, row.stock),
			);
			clearFeedback(row.variantId);
		} catch (caught) {
			if (isConflict(caught)) {
				// The request carries three fields and only the SKU is unique, so a
				// 409 is that duplicate. The server's own wording goes on the field.
				setRowErrors(row.variantId, { sku: caught.message });
				return;
			}

			message.error(
				apiErrorMessage(
					caught,
					"Could not save this variant. Your edit is still here — try again.",
				),
			);
		} finally {
			setSavingIds((previous) => {
				const next = { ...previous };
				delete next[row.variantId];
				return next;
			});
		}
	}

	async function removeRow(row: VariantRow) {
		setRemovingIds((previous) => ({ ...previous, [row.variantId]: true }));

		try {
			await deleteVariant(row.variantId);
			onRemoved(row.variantId);
			clearFeedback(row.variantId);
			message.success(`Variant ${row.sku} removed.`);
		} catch (caught) {
			message.error(
				apiErrorMessage(caught, "Could not remove the variant. Please try again."),
			);
		} finally {
			setRemovingIds((previous) => {
				const next = { ...previous };
				delete next[row.variantId];
				return next;
			});
		}
	}

	/**
	 * A cell's input, its error text, and the commit wiring in one place, so the
	 * three editable columns cannot drift apart.
	 */
	function editableCell<Field extends keyof RowDraft>(
		row: VariantRow,
		field: Field,
		control: (props: {
			value: RowDraft[Field];
			onChange: (value: RowDraft[Field]) => void;
			invalid: boolean;
			disabled: boolean;
			/** The row's readable name, for the control's accessible label. */
			rowLabel: string;
		}) => ReactNode,
	) {
		const error = errors[row.variantId]?.[field];
		const busy =
			savingIds[row.variantId] === true || removingIds[row.variantId] === true;

		return (
			<Flex vertical gap={4}>
				{control({
					value: draftFor(row)[field],
					onChange: (value) => updateDraft(row, { [field]: value }),
					invalid: error !== undefined,
					disabled: busy,
					rowLabel: variantLabel(row),
				})}
				{error !== undefined && (
					<Text type="danger" role="alert" className={styles.cellError}>
						{error}
					</Text>
				)}
			</Flex>
		);
	}

	const columns: TableColumnsType<VariantRow> = [
		{
			title: "Variant",
			key: "label",
			render: (_, row) => (
				<Flex align="center" gap={8}>
					<Text>{variantLabel(row)}</Text>
					{savingIds[row.variantId] && <Spin size="small" />}
				</Flex>
			),
		},
		{
			title: "SKU",
			key: "sku",
			width: 220,
			render: (_, row) =>
				editableCell(
					row,
					"sku",
					({ value, onChange, invalid, disabled, rowLabel }) => (
						<Input
							value={value}
							onChange={(event) => onChange(event.target.value)}
							onBlur={() => void commitRow(row)}
							onPressEnter={() => void commitRow(row)}
							status={invalid ? "error" : undefined}
							disabled={disabled}
							aria-label={`SKU for ${rowLabel}`}
						/>
					),
				),
		},
		{
			title: "Price (VND)",
			key: "price",
			width: 150,
			render: (_, row) =>
				editableCell(
					row,
					"price",
					({ value, onChange, invalid, disabled, rowLabel }) => (
						<InputNumber
							value={value}
							onChange={(next) =>
								onChange(typeof next === "number" ? next : null)
							}
							onBlur={() => void commitRow(row)}
							onPressEnter={() => void commitRow(row)}
							min={0}
							precision={0}
							controls={false}
							status={invalid ? "error" : undefined}
							disabled={disabled}
							style={{ width: "100%" }}
							aria-label={`Price in VND for ${rowLabel}`}
						/>
					),
				),
		},
		{
			title: "Stock",
			key: "stock",
			width: 110,
			render: (_, row) =>
				editableCell(
					row,
					"stock",
					({ value, onChange, invalid, disabled, rowLabel }) => (
						<InputNumber
							value={value}
							onChange={(next) =>
								onChange(typeof next === "number" ? next : null)
							}
							onBlur={() => void commitRow(row)}
							onPressEnter={() => void commitRow(row)}
							min={0}
							step={1}
							precision={0}
							status={invalid ? "error" : undefined}
							disabled={disabled}
							style={{ width: "100%" }}
							aria-label={`Stock for ${rowLabel}`}
						/>
					),
				),
		},
		{
			title: "Attributes",
			key: "attributes",
			width: 260,
			render: (_, row) => (
				<Flex vertical gap={4}>
					{row.attributes.length === 0 ? (
						<Text type="secondary">None</Text>
					) : (
						<Flex wrap gap={4}>
							{row.attributes.map((link) => (
								<Tag key={link.variantValueId}>
									{describeAttributeLink(link)}
								</Tag>
							))}
						</Flex>
					)}
					<Button
						type="link"
						size="small"
						icon={<SettingOutlined />}
						className={styles.attributeAction}
						aria-label={`Edit attributes for ${variantLabel(row)}`}
						onClick={() => onEditAttributes(row.variantId)}
					>
						Edit
					</Button>
				</Flex>
			),
		},
		{
			title: "Remove",
			key: "remove",
			width: 90,
			render: (_, row) => {
				if (!mayDelete) {
					return null;
				}

				const busy =
					savingIds[row.variantId] === true || removingIds[row.variantId] === true;

				return (
					<Popconfirm
						title={`Remove variant ${row.sku}?`}
						description="It stops counting toward the product's price range and stock, and the storefront no longer offers it. This cannot be undone from the portal."
						okText="Remove variant"
						okButtonProps={{ danger: true }}
						cancelText="Cancel"
						onConfirm={() => void removeRow(row)}
						disabled={busy}
					>
						<Button
							type="text"
							danger
							icon={<DeleteOutlined />}
							aria-label={`Remove variant ${row.sku}`}
							loading={removingIds[row.variantId] === true}
							disabled={busy}
						/>
					</Popconfirm>
				);
			},
		},
	];

	return (
		<Table<VariantRow>
			rowKey="variantId"
			dataSource={rows}
			columns={columns}
			pagination={false}
			size="small"
			locale={{
				emptyText:
					"No variants yet. A product without a variant has no price and cannot be sold.",
			}}
		/>
	);
}
