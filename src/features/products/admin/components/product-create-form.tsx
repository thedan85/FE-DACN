"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Form, Result, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

import { ApiError } from "@/lib/api/client";
import { getCategories } from "@/features/products/api/products.api";
import type { Category } from "@/features/products/types";

import { createProduct } from "../api/products.api";
import { CATALOG_PERMISSIONS } from "../model/permissions";
import {
	toProductCreateInput,
	type ProductFormValues,
} from "../model/product-form";
import type { EditableProductStatus } from "../model/product-status";
import { useCatalogPermissions } from "../use-catalog-permissions";
import { AdminCatalogTheme } from "./admin-catalog-theme";
import {
	ProductInformationCard,
	ProductSettingsColumn,
} from "./product-form-sections";
import styles from "./product-form-page.module.css";

const { Title, Text } = Typography;

const LISTING_PATH = "/admin/products";

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
 * Creating is a single request. Attributes, variants and media are configured
 * on the product's edit page rather than staged into the create call:
 * `POST /products` is the only way to obtain a `productId`, and each of those
 * is its own resource against that id.
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

			message.success(`"${created.name}" created as a draft.`);

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
							<ProductInformationCard disabled={saving} />
						</div>

						<ProductSettingsColumn
							disabled={saving}
							form={form}
							status={status}
							onStatusChange={setStatus}
							categories={categories}
							categoriesLoading={categoriesLoading}
							categoriesFailed={categoriesFailed}
							// No storefront page exists until the product is created.
							onDeriveSlug={() => {
								// `setFieldValue` fires no change event; the create form has no
								// diff to recompute, so there is nothing to sync here.
							}}
						/>
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
