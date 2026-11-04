"use client";

import { useState } from "react";
import { App, Form, Input, InputNumber, Modal } from "antd";

import { createVariant } from "../api/variants.api";
import { apiErrorMessage, isConflict } from "../model/api-error";
import {
	rowFromVariantRecord,
	validateVariantPrice,
	validateVariantSku,
	validateVariantStock,
	type VariantRow,
} from "../model/variants";

/** An unsubmitted row: the same three fields, with numbers still nullable. */
type CreateFormValues = {
	sku: string;
	price: number | null;
	stock: number | null;
};

type VariantCreateModalProps = {
	productId: string;
	open: boolean;
	onCancel: () => void;
	/** Called with the row the server created, so the table can show it at once. */
	onCreated: (row: VariantRow) => void;
};

/**
 * Creates one variant row.
 *
 * A variant is created **immediately** rather than staged: `POST /variants`
 * returns the `variantId` the row's attribute links and later edits are
 * addressed by (ADR-0003, spec.md § Variants), so there is no half-made row to
 * hold in client state.
 *
 * Each input validates with the model's own single-field rule, so the client
 * refuses exactly what the API's `@NotBlank` / `@PositiveOrZero` /
 * non-negative-integer annotations would. A duplicate SKU is the one failure
 * only the server can decide, and its 409 is rendered under the SKU input rather
 * than as a page-level banner, because the field is the only thing that can fix
 * it.
 */
export function VariantCreateModal({
	productId,
	open,
	onCancel,
	onCreated,
}: VariantCreateModalProps) {
	const { message } = App.useApp();
	const [form] = Form.useForm<CreateFormValues>();
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(values: CreateFormValues) {
		setSubmitting(true);

		try {
			const created = await createVariant({
				productId,
				sku: values.sku.trim(),
				price: values.price ?? Number.NaN,
				stock: values.stock ?? 0,
			});

			onCreated(rowFromVariantRecord(created));
			message.success(`Variant ${created.sku} added.`);
			form.resetFields();
			onCancel();
		} catch (caught) {
			if (isConflict(caught)) {
				// The only unique value this request carries is the SKU, so a 409
				// here is that duplicate. Show the server's own words rather than
				// inventing a friendlier message that might be less accurate.
				form.setFields([{ name: "sku", errors: [caught.message] }]);
				return;
			}

			message.error(
				apiErrorMessage(caught, "Could not add the variant. Please try again."),
			);
		} finally {
			setSubmitting(false);
		}
	}

	/** Wraps one model rule as an antd validator, so the field owns its message. */
	function ruleFor(check: (value: never) => string | undefined) {
		return async (_: unknown, value: unknown) => {
			const error = check(value as never);

			if (error !== undefined) {
				throw new Error(error);
			}
		};
	}

	return (
		<Modal
			title="Add variant"
			open={open}
			onCancel={() => {
				form.resetFields();
				onCancel();
			}}
			onOk={() => form.submit()}
			okText="Add variant"
			cancelText="Cancel"
			confirmLoading={submitting}
			// A half-typed row must not reappear the next time the dialog opens.
			destroyOnHidden
			width={480}
		>
			<Form<CreateFormValues>
				form={form}
				layout="vertical"
				requiredMark
				initialValues={{ stock: 0 }}
				onFinish={(values) => void handleSubmit(values)}
			>
				<Form.Item
					name="sku"
					label="SKU"
					required
					extra="Unique across the whole catalog, not just this product."
					rules={[{ validator: ruleFor(validateVariantSku) }]}
				>
					<Input placeholder="e.g. FISH-PENGUIN-TETRA" maxLength={255} />
				</Form.Item>

				<Form.Item
					name="price"
					label="Price (VND)"
					required
					rules={[{ validator: ruleFor(validateVariantPrice) }]}
				>
					<InputNumber
						min={0}
						precision={0}
						controls={false}
						style={{ width: "100%" }}
						placeholder="e.g. 15000"
					/>
				</Form.Item>

				<Form.Item
					name="stock"
					label="Stock"
					required
					rules={[{ validator: ruleFor(validateVariantStock) }]}
				>
					<InputNumber
						min={0}
						step={1}
						precision={0}
						style={{ width: "100%" }}
						placeholder="0"
					/>
				</Form.Item>
			</Form>
		</Modal>
	);
}
