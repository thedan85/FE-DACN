"use client";

import { App, Button, Card, Form, Input, Segmented, Select, Typography } from "antd";
import type { FormInstance } from "antd";

import type { Category } from "@/features/products/types";

import { categoryOptions, validateProductForm } from "../model/product-form";
import type { ProductFormValues } from "../model/product-form";
import {
	EDITABLE_PRODUCT_STATUSES,
	productStatusLabel,
	type EditableProductStatus,
} from "../model/product-status";
import { deriveSlug } from "../model/slug";
import styles from "./product-form-sections.module.css";

const { Text } = Typography;

const STATUS_OPTIONS = EDITABLE_PRODUCT_STATUSES.map((status) => ({
	value: status,
	label: productStatusLabel(status),
}));

/** The design's helper copy for each status, shown under the control. */
export const STATUS_HELP: Record<EditableProductStatus, string> = {
	DRAFT:
		"This product is not visible in your storefront. Publish when you're ready.",
	ACTIVE:
		"This product is visible in your storefront and available for purchase.",
	INACTIVE:
		"This product is hidden from your storefront but kept for later reuse.",
};

type SectionProps = {
	/** Disables every control while a save is in flight. */
	disabled: boolean;
};

/**
 * The product's text fields — the card in the main column.
 *
 * One definition shared by the create and edit screens: the fields, their
 * labels and their validation rules are the same on both, and a second copy
 * would let the two forms drift (the create form once accepted a whitespace
 * description that the model already rejected).
 */
export function ProductInformationCard({ disabled }: SectionProps) {
	return (
		<Card title="Product information">
			<Form.Item
				name="name"
				label="Product title"
				// `required` drives the asterisk and `aria-required`; the validator
				// mirrors the API's own rules (`validateProductForm`), so the client
				// rejects exactly what the server would.
				required
				rules={[
					{
						validator: async (_, value: string) => {
							const error = validateProductForm({
								name: value ?? "",
								description: "x",
							}).name;

							if (error) {
								throw new Error(error);
							}
						},
					},
				]}
			>
				<Input
					placeholder="e.g. Blue Dream Shrimp"
					maxLength={255}
					disabled={disabled}
				/>
			</Form.Item>

			<Form.Item
				name="description"
				label="Description"
				extra="Shown on the product page and listing cards."
				required
				rules={[
					{
						// `required: true` alone accepts whitespace, which the request
						// builder then trims to "" — the API's `@NotBlank` would 400 it
						// into the banner instead of this field.
						validator: async (_, value: string) => {
							const error = validateProductForm({
								name: "x",
								description: value ?? "",
							}).description;

							if (error) {
								throw new Error(error);
							}
						},
					},
				]}
			>
				<Input.TextArea
					rows={4}
					placeholder="A short summary of the product."
					disabled={disabled}
				/>
			</Form.Item>

			<Form.Item
				name="detailDescription"
				label="Detail description"
				extra="Plain text. Each line becomes a paragraph on the product page."
			>
				<Input.TextArea
					rows={6}
					placeholder="Care notes, setup guidance, and anything else the product page should explain."
					disabled={disabled}
				/>
			</Form.Item>
		</Card>
	);
}

type SettingsColumnProps = SectionProps & {
	form: FormInstance<ProductFormValues>;
	status: EditableProductStatus;
	onStatusChange: (status: EditableProductStatus) => void;
	categories: Category[];
	categoriesLoading: boolean;
	categoriesFailed: boolean;
	/**
	 * When set, the status card links to the product's storefront page — the
	 * edit screen passes it; the create screen has no product yet.
	 */
	storefrontSlug?: string;
	/** Called when the derive control writes into the form, so the caller can re-read it. */
	onDeriveSlug: () => void;
};

/**
 * The settings column: status, category and URL handle.
 *
 * Status is React state rather than a `Form.Item` because it is a `Segmented`
 * control, not an input; the caller owns that value and folds it into the
 * request. Everything else is Form-managed.
 */
export function ProductSettingsColumn({
	disabled,
	form,
	status,
	onStatusChange,
	categories,
	categoriesLoading,
	categoriesFailed,
	storefrontSlug,
	onDeriveSlug,
}: SettingsColumnProps) {
	const { message } = App.useApp();
	return (
		<div className={styles.settingsColumn}>
			<Card title="Status">
				{/* No `htmlFor`: the target is a `role="radiogroup"` div, which is not
				    labelable, so the group carries its own `aria-label`. */}
				<Form.Item label="Status">
					<Segmented<EditableProductStatus>
						block
						aria-label="Status"
						value={status}
						options={STATUS_OPTIONS}
						disabled={disabled}
						onChange={onStatusChange}
					/>
				</Form.Item>
				<Text type="secondary">{STATUS_HELP[status]}</Text>
				{storefrontSlug !== undefined && (
					<div className={styles.storefrontLink}>
						<Button
							type="link"
							size="small"
							href={`/products/${storefrontSlug}`}
							target="_blank"
							rel="noopener noreferrer"
						>
							View in storefront
						</Button>
					</div>
				)}
			</Card>

			<Card title="Organization">
				<Form.Item name="categoryId" label="Category">
					<Select
						allowClear
						showSearch={{ optionFilterProp: "label" }}
						placeholder={
							categoriesFailed
								? "Categories could not be loaded"
								: "Choose a category"
						}
						disabled={disabled || categoriesFailed}
						options={categoryOptions(categories)}
						loading={categoriesLoading}
					/>
				</Form.Item>

				<Form.Item
					name="slug"
					label="URL handle"
					extra="Leave blank to derive it from the name."
					rules={[
						{
							validator: async (_, value: string) => {
								const error = validateProductForm({
									name: "x",
									description: "y",
									slug: value ?? "",
								}).slug;

								if (error) {
									throw new Error(error);
								}
							},
						},
					]}
				>
					<Input
						prefix="/products/"
						placeholder="blue-dream-shrimp"
						disabled={disabled}
					/>
				</Form.Item>

				<Button
					disabled={disabled}
					onClick={() => {
						// Fills the field from the title rather than submitting, so the
						// derived slug stays editable before save.
						const name: unknown = form.getFieldValue("name");

						if (typeof name !== "string" || name.trim() === "") {
							message.info("Enter a product title first.");
							return;
						}

						form.setFieldValue("slug", deriveSlug(name));
						// `setFieldValue` fires no change event, so the caller's dirty
						// tracking has to be told to re-read the form.
						onDeriveSlug();
					}}
				>
					Use name as URL handle
				</Button>
			</Card>
		</div>
	);
}
