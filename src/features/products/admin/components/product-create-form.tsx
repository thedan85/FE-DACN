"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	Alert,
	App,
	Button,
	Card,
	Form,
	Input,
	Result,
	Segmented,
	Select,
	Typography,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

import { ApiError } from "@/lib/api/client";
import { getCategories } from "@/features/products/api/products.api";
import type { Category } from "@/features/products/types";

import { createProduct } from "../api/products.api";
import { CATALOG_PERMISSIONS } from "../model/permissions";
import {
	categoryOptions,
	toProductCreateInput,
	validateProductForm,
	type ProductFormValues,
} from "../model/product-form";
import {
	EDITABLE_PRODUCT_STATUSES,
	productStatusLabel,
	type EditableProductStatus,
} from "../model/product-status";
import { deriveSlug } from "../model/slug";
import { useCatalogPermissions } from "../use-catalog-permissions";
import { AdminCatalogTheme } from "./admin-catalog-theme";
import styles from "./product-create-form.module.css";

const { Title, Text } = Typography;

const LISTING_PATH = "/admin/products";

/** The design's helper copy for each status, shown under the control. */
const STATUS_HELP: Record<EditableProductStatus, string> = {
	DRAFT:
		"This product is not visible in your storefront. Publish when you're ready.",
	ACTIVE:
		"This product is visible in your storefront and available for purchase.",
	INACTIVE:
		"This product is hidden from your storefront but kept for later reuse.",
};

const STATUS_OPTIONS = EDITABLE_PRODUCT_STATUSES.map((status) => ({
	value: status,
	label: productStatusLabel(status),
}));

type SaveState =
	| { status: "idle" }
	| { status: "saving" }
	| { status: "error"; message: string };

/**
 * Create-product form.
 *
 * Draft-first: the status control defaults to Draft and is always sent. The
 * backend persists what the request asks for, but defaults an *omitted* status
 * to ACTIVE, so omitting it would publish the product by accident.
 *
 * Creating is a single request here. Attributes, variants and media are
 * configured on the product's edit page rather than staged into the create
 * call: `POST /products` is the only way to obtain a `productId`, and each of
 * those is its own resource against that id. Keeping them out of this form
 * means a half-finished product is never created with partial children —
 * the user lands on the edit page and adds them there.
 */
export function ProductCreateForm() {
	const router = useRouter();
	const { message } = App.useApp();
	const { can } = useCatalogPermissions();
	const [form] = Form.useForm<ProductFormValues>();
	const [status, setStatus] = useState<EditableProductStatus>("DRAFT");
	const [categories, setCategories] = useState<Category[]>([]);
	const [categoriesLoading, setCategoriesLoading] = useState(true);
	const [categoriesFailed, setCategoriesFailed] = useState(false);
	const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

	const mayCreate = can(CATALOG_PERMISSIONS.productCreate);

	useEffect(() => {
		let active = true;

		getCategories()
			.then((result) => {
				if (active) {
					setCategories(result);
				}
			})
			.catch(() => {
				// The category is optional, so a failed fetch must not block creating
				// the product — but silently emptying the select would look like the
				// catalog has no categories. Say so instead.
				if (active) {
					setCategories([]);
					setCategoriesFailed(true);
				}
			})
			.finally(() => {
				if (active) {
					setCategoriesLoading(false);
				}
			});

		return () => {
			active = false;
		};
	}, []);

	const saving = saveState.status === "saving";

	async function handleFinish(values: ProductFormValues) {
		// The button's `loading` is visual only: Enter in a text field and a rapid
		// double click both submit, and two POSTs would create two products.
		if (saveState.status === "saving") {
			return;
		}

		setSaveState({ status: "saving" });

		try {
			const created = await createProduct(
				toProductCreateInput({ ...values, status }),
			);

			message.success(`"${created.name}" saved as ${productStatusLabel(created.status)}.`);

			// The edit route is the product's permanent home; the slug is what the
			// API returns, which may differ from a derived one after a collision.
			router.push(`${LISTING_PATH}/${created.slug}/edit`);
		} catch (caught) {
			const apiError = caught instanceof ApiError ? caught : null;

			// A duplicate slug belongs on its field, not in a banner: it is one
			// field's problem and the user can fix it without losing the rest.
			if (apiError?.status === 409) {
				form.setFields([{ name: "slug", errors: [apiError.message] }]);
				setSaveState({ status: "idle" });
				return;
			}

			setSaveState({
				status: "error",
				message:
					apiError !== null && apiError.status > 0
						? apiError.message
						: "Could not reach the server. Check your connection and try again.",
			});
		}
	}

	// A direct URL must not offer a form that can only end in a 403. The backend
	// enforces the permission regardless; this keeps the user out of a dead end.
	// `Result` rather than the catalog's load-error state: "couldn't load, check
	// your connection, try again" would misdescribe an authorization refusal.
	if (!mayCreate) {
		return (
			<AdminCatalogTheme>
				<Result
					status="403"
					title="You can't add products"
					subTitle="Creating products needs the product:create permission. Ask an administrator to grant it to your role."
					extra={
						<Button href={LISTING_PATH}>Back to Products &amp; Variants</Button>
					}
				/>
			</AdminCatalogTheme>
		);
	}

	return (
		<AdminCatalogTheme>
			<section className={styles.page}>
				<header className={styles.header}>
					<Link className={styles.back} href={LISTING_PATH}>
						<ArrowLeftOutlined aria-hidden="true" /> Products &amp; Variants
					</Link>
					<Title level={1} className={styles.title}>
						Add product
					</Title>
					<Text type="secondary">
						Create a product and configure its options before publishing.
					</Text>
					<Alert
						className={styles.notice}
						type="info"
						showIcon
						title="New products are saved as drafts. Add images and review your variants before making this product active."
					/>
				</header>

				{saveState.status === "error" && (
					<Alert
						type="error"
						showIcon
						title="Couldn't create the product"
						description={saveState.message}
					/>
				)}

				{/* `layout="vertical"` puts the label above the control, which is what
				    the design does; `scrollToFirstError` moves focus to whichever
				    required field is missing instead of leaving the user to hunt. */}
				<Form<ProductFormValues>
					form={form}
					layout="vertical"
					requiredMark
					scrollToFirstError={{ focus: true }}
					onFinish={(values) => void handleFinish(values)}
				>
					<div className={styles.columns}>
						<div className={styles.mainColumn}>
							<Card title="Product information">
								<Form.Item
									name="name"
									label="Product title"
									// `required` drives the asterisk and `aria-required`; the
									// validator below mirrors the API's own rules
									// (`validateProductForm`), so the client rejects exactly
									// what the server would.
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
										disabled={saving}
									/>
								</Form.Item>

								<Form.Item
									name="description"
									label="Description"
									extra="Shown on the product page and listing cards."
									required
									rules={[
										{
											// `required: true` alone accepts whitespace, which
											// `toProductCreateInput` then trims to "" — the API's
											// `@NotBlank` would 400 it into the banner instead of
											// this field. The same validator the model uses keeps
											// the two in agreement.
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
										disabled={saving}
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
										disabled={saving}
									/>
								</Form.Item>
							</Card>
						</div>

						<div className={styles.settingsColumn}>
							<Card title="Status">
								{/* No `htmlFor`: the target is a `role="radiogroup"` div, which is
								    not labelable, so the group carries its own `aria-label`. */}
								<Form.Item label="Status">
									<Segmented<EditableProductStatus>
										block
										aria-label="Status"
										value={status}
										options={STATUS_OPTIONS}
										disabled={saving}
										onChange={(value) => setStatus(value)}
									/>
								</Form.Item>
								<Text type="secondary">{STATUS_HELP[status]}</Text>
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
										disabled={saving || categoriesFailed}
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
										disabled={saving}
									/>
								</Form.Item>

								<Button
									disabled={saving}
									onClick={() => {
										// Fills the field from the title rather than submitting,
										// so the derived slug stays editable before save.
										const name = form.getFieldValue("name") as
											| string
											| undefined;

										if (!name?.trim()) {
											message.info("Enter a product title first.");
											return;
										}

										form.setFieldValue("slug", deriveSlug(name));
									}}
								>
									Use name as URL handle
								</Button>
							</Card>
						</div>
					</div>

					<footer className={styles.saveBar}>
						<Text type="secondary" className={styles.saveStatus} aria-live="polite">
							{saving
								? "Saving…"
								: saveState.status === "error"
									? "New product · Not saved — see the error above"
									: "New product · Not saved"}
						</Text>
						<Button href={LISTING_PATH} disabled={saving}>
							Discard
						</Button>
						<Button type="primary" htmlType="submit" loading={saving}>
							Save product
						</Button>
					</footer>
				</Form>
			</section>
		</AdminCatalogTheme>
	);
}
