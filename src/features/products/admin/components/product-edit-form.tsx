"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Card, Form, Popconfirm, Typography } from "antd";
import { ArrowLeftOutlined, ExportOutlined } from "@ant-design/icons";

import { ApiError } from "@/lib/api/client";
import { getCategories } from "@/features/products/api/products.api";
import { formatDate } from "@/features/products/storefront/model/product-format";
import type { Category, ProductDetail } from "@/features/products/types";

import { deleteProduct, patchProduct, putProduct } from "../api/products.api";
import { CATALOG_PERMISSIONS } from "../model/permissions";
import {
	buildProductRequest,
	hasProductChanges,
	toProductFormValues,
} from "../model/product-edit";
import type { ProductFormValues } from "../model/product-form";
import type { EditableProductStatus } from "../model/product-status";
import { toVariantRows, type VariantRow } from "../model/variants";
import { useCatalogPermissions } from "../use-catalog-permissions";
import { ProductAttributesCard } from "./product-attributes-card";
import {
	ProductInformationCard,
	ProductSettingsColumn,
} from "./product-form-sections";
import { VariantsCard } from "./variants-card";
import styles from "./product-form-page.module.css";

const { Title, Text } = Typography;

const LISTING_PATH = "/admin/products";

type SaveState =
	| { status: "idle" }
	| { status: "saving" }
	| { status: "saved" }
	| { status: "error"; message: string };

type ProductEditFormProps = {
	detail: ProductDetail;
};

/**
 * Edit form for one product.
 *
 * The request is a diff (`buildProductRequest`), so an untouched field is never
 * re-sent — and the method is chosen, not assumed: a cleared category needs a
 * `PUT`, because a `PATCH` with a null category is a silent no-op on the server.
 *
 * Form values come from `Form.useWatch`, which is the only reactive view of the
 * form: a hand-maintained copy misses `setFieldValue` (the derive-slug button),
 * leaving the save button disabled over a visibly changed field.
 *
 * Archive and Delete are deliberately different weights (ADR-0002): Archive is
 * a status change and reversible; Delete is terminal and confirmed by name.
 */
export function ProductEditForm({ detail }: ProductEditFormProps) {
	const router = useRouter();
	const { message, modal } = App.useApp();
	const { can } = useCatalogPermissions();

	const [form] = Form.useForm<ProductFormValues>();
	/** The product as last known to this component; refreshed after each save. */
	const [product, setProduct] = useState(detail.product);
	/**
	 * The product's attribute links. Held here rather than read from `detail`
	 * because adds and removes are immediate and the aggregate prop is only
	 * refetched on remount, so the card would otherwise show a stale list.
	 */
	const [links, setLinks] = useState(detail.attributes);
	/**
	 * The product's variants, held here so the header's SKU and the card's stock
	 * total read the same rows. Each write is immediate, so these are updated
	 * from the server's own responses rather than from the form's save.
	 */
	const [variants, setVariants] = useState<VariantRow[]>(() =>
		toVariantRows(detail.variants),
	);
	const [status, setStatus] = useState<EditableProductStatus>(
		() => toProductFormValues(detail.product).status,
	);
	const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
	const [deleting, setDeleting] = useState(false);
	/** Guards against a second submit while the first is in flight. */
	const [inFlight, setInFlight] = useState(false);
	const [categories, setCategories] = useState<Category[]>([]);
	const [categoriesLoading, setCategoriesLoading] = useState(true);
	const [categoriesFailed, setCategoriesFailed] = useState(false);

	const watched = Form.useWatch([], form) as Partial<ProductFormValues> | undefined;

	const mayUpdate = can(CATALOG_PERMISSIONS.productUpdate);
	const mayDelete = can(CATALOG_PERMISSIONS.productDelete);

	const saving = saveState.status === "saving";
	const busy = saving || deleting;

	const current: ProductFormValues = {
		name: watched?.name ?? product.name,
		description: watched?.description ?? product.description,
		detailDescription: watched?.detailDescription ?? product.detailDescription,
		categoryId: watched?.categoryId,
		slug: watched?.slug ?? product.slug,
		status,
	};

	const dirty = hasProductChanges(current, product);

	// The first variant is the default one (the backend sorts it first), and it
	// is the only SKU a product has — SKUs belong to variants. Read from the
	// live rows so editing a SKU in the card updates the header too.
	const firstVariantSku = variants[0]?.sku ?? null;
	const updated = formatDate(product.updatedAt);

	useEffect(() => {
		let active = true;

		getCategories()
			.then((result) => {
				if (active) {
					setCategories(result);
				}
			})
			.catch(() => {
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

	// Warn before a full page unload (tab close, reload, external link).
	// In-app navigation is guarded at the two affordances that leave the page;
	// the App Router has no navigation blocker, so a sidebar click cannot be
	// intercepted from here.
	useEffect(() => {
		if (!dirty) {
			return;
		}

		function handleBeforeUnload(event: BeforeUnloadEvent) {
			event.preventDefault();
			// Some browsers require a returnValue assignment to show the prompt.
			event.returnValue = "";
		}

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [dirty]);

	/** Leaves the page, confirming first when there is unsaved work. */
	function navigateAway(go: () => void) {
		if (!dirty) {
			go();
			return;
		}

		modal.confirm({
			title: "Discard unsaved changes?",
			content: "Your edits to this product will be lost.",
			okText: "Discard changes",
			okButtonProps: { danger: true },
			cancelText: "Keep editing",
			onOk: go,
		});
	}

	function markEdited() {
		// Any edit invalidates a previous "saved" confirmation.
		if (saveState.status === "saved" || saveState.status === "error") {
			setSaveState({ status: "idle" });
		}
	}

	/**
	 * Sends the pending change and refreshes local state from the response, so
	 * the diff after a save is against what the server now holds — otherwise the
	 * form stays "dirty" forever and re-sends the same patch.
	 */
	async function persist(
		plan: NonNullable<ReturnType<typeof buildProductRequest>>,
		successMessage: string,
	) {
		if (inFlight) {
			return;
		}

		setInFlight(true);
		setSaveState({ status: "saving" });

		try {
			const saved =
				plan.method === "PUT"
					? await putProduct(product.productId, plan.body)
					: await patchProduct(product.productId, plan.body);

			const nextValues = toProductFormValues(saved);
			setProduct(saved);
			setStatus(nextValues.status);
			form.setFieldsValue(nextValues);
			setSaveState({ status: "saved" });
			message.success(successMessage);

			const slugChanged = saved.slug !== detail.product.slug;

			if (slugChanged) {
				// The old URL now 404s, so the address bar must move with the product.
				router.replace(`${LISTING_PATH}/${saved.slug}/edit`);
			}

			router.refresh();
			return saved;
		} catch (caught) {
			const apiError = caught instanceof ApiError ? caught : null;

			if (apiError?.status === 409) {
				form.setFields([{ name: "slug", errors: [apiError.message] }]);
				setSaveState({ status: "error", message: "That URL handle is taken." });
				return null;
			}

			setSaveState({
				status: "error",
				message:
					apiError !== null && apiError.status > 0
						? apiError.message
						: "Could not reach the server. Check your connection and try again.",
			});
			return null;
		} finally {
			setInFlight(false);
		}
	}

	async function handleSave(values: ProductFormValues) {
		const plan = buildProductRequest({ ...values, status }, product);

		if (plan === null) {
			message.info("There are no changes to save.");
			return;
		}

		await persist(plan, "Changes saved.");
	}

	async function handleArchive() {
		// Archive is an action, not a form edit: it writes immediately.
		const plan = buildProductRequest(
			{ ...current, status: "INACTIVE" },
			product,
		);

		if (plan === null) {
			message.info("This product is already archived.");
			return;
		}

		await persist(plan, `"${product.name}" archived.`);
	}

	async function handleDelete() {
		setDeleting(true);

		try {
			await deleteProduct(product.productId);
			message.success(`"${product.name}" deleted.`);
			// Returns to the listing; its own URL state is preserved by the router,
			// so a filtered view stays filtered.
			router.push(LISTING_PATH);
		} catch (caught) {
			setDeleting(false);
			message.error(
				caught instanceof ApiError && caught.status > 0
					? caught.message
					: "Could not delete the product. Please try again.",
			);
		}
	}

	const saveStatusText = () => {
		if (deleting) {
			return "Deleting…";
		}

		if (saving) {
			return "Saving changes…";
		}

		switch (saveState.status) {
			case "saved":
				return dirty ? "Unsaved changes" : "All changes saved";
			case "error":
				return "Couldn't save changes. Your edits are safe. Try again.";
			default:
				return dirty ? "Unsaved changes" : "No changes yet";
		}
	};

	return (
		<section className={styles.page}>
			<header className={styles.header}>
				<Button
					type="link"
					className={styles.back}
					icon={<ArrowLeftOutlined />}
					onClick={() => navigateAway(() => router.push(LISTING_PATH))}
				>
					Products &amp; Variants
				</Button>

				<div className={styles.titleRow}>
					<div>
						<Title level={1} className={styles.title}>
							Edit product
						</Title>
						<Text type="secondary">
							{product.name}
							{firstVariantSku !== null && ` · ${firstVariantSku}`}
							{updated !== null && ` · Last updated ${updated}`}
						</Text>
					</div>

					<Button
						href={`/products/${product.slug}`}
						target="_blank"
						rel="noopener noreferrer"
						icon={<ExportOutlined />}
					>
						Preview
					</Button>
				</div>
			</header>

			{saveState.status === "error" && (
				<Alert
					type="error"
					showIcon
					title="Couldn't save changes"
					description={saveState.message}
				/>
			)}

			<Form<ProductFormValues>
				form={form}
				layout="vertical"
				requiredMark
				scrollToFirstError={{ focus: true }}
				initialValues={toProductFormValues(detail.product)}
				// Disabled wholesale while a write is in flight or without the
				// permission, so a second edit cannot race the payload being sent.
				disabled={!mayUpdate || busy}
				onValuesChange={markEdited}
				onFinish={(values) => void handleSave(values)}
			>
				<div className={styles.columns}>
					<div className={styles.mainColumn}>
						<ProductInformationCard disabled={!mayUpdate || busy} />

						{/* Attributes are their own resources, so this card writes
						    immediately and sits outside the form's save. */}
						<ProductAttributesCard
							productId={product.productId}
							links={links}
							onLinksChanged={setLinks}
						/>

						{/* Variants likewise: each row is its own resource and saves on
						    its own, so the save bar below has nothing to send for them. */}
						<VariantsCard
							productId={product.productId}
							variants={variants}
							onVariantAdded={(added) =>
								setVariants((previous) => [...previous, added])
							}
							onVariantFieldsSaved={(variantId, fields) =>
								setVariants((previous) =>
									previous.map((variant) =>
										variant.variantId === variantId
											? { ...variant, ...fields }
											: variant,
									),
								)
							}
							onVariantAttributesChanged={(variantId, attributes) =>
								setVariants((previous) =>
									previous.map((variant) =>
										variant.variantId === variantId
											? { ...variant, attributes }
											: variant,
									),
								)
							}
							onVariantRemoved={(removedId) =>
								setVariants((previous) =>
									previous.filter((variant) => variant.variantId !== removedId),
								)
							}
						/>
					</div>

					{mayUpdate && (
						<ProductSettingsColumn
							disabled={busy}
							form={form}
							status={status}
							onStatusChange={(next) => {
								setStatus(next);
								markEdited();
							}}
							categories={categories}
							categoriesLoading={categoriesLoading}
							categoriesFailed={categoriesFailed}
							storefrontSlug={product.slug}
							onDeriveSlug={markEdited}
						/>
					)}
				</div>

				{/* Archive and Delete sit apart from the save bar: one withdraws the
				    product from sale, the other ends it. */}
				{(mayUpdate || mayDelete) && (
					<Card title="Product actions" className={styles.dangerZone}>
						{mayUpdate && (
							<div className={styles.dangerRow}>
								<div className={styles.dangerText}>
									<Text strong>Archive this product</Text>
									<Text type="secondary" className={styles.dangerHelp}>
										{product.status === "INACTIVE"
											? "This product is already archived."
											: "Hides it from the storefront but keeps it for later reuse. Reversible."}
									</Text>
								</div>
								<Button
									disabled={busy || product.status === "INACTIVE"}
									loading={saving}
									onClick={() => void handleArchive()}
								>
									Archive
								</Button>
							</div>
						)}

						{mayDelete && (
							<div className={styles.dangerRow}>
								<div className={styles.dangerText}>
									<Text strong>Delete this product</Text>
									<Text type="secondary" className={styles.dangerHelp}>
										Removes it from every listing and from the storefront.
										Cannot be undone from the portal.
									</Text>
								</div>
								<Popconfirm
									title={`Delete "${product.name}"?`}
									description="The product is removed from the storefront and every listing. This cannot be undone from the portal."
									okText="Delete product"
									okButtonProps={{ danger: true }}
									cancelText="Cancel"
									onConfirm={() => void handleDelete()}
									disabled={busy}
								>
									<Button danger disabled={busy} loading={deleting}>
										Delete
									</Button>
								</Popconfirm>
							</div>
						)}
					</Card>
				)}

				<footer className={styles.saveBar}>
					<Text type="secondary" className={styles.saveStatus} aria-live="polite">
						{saveStatusText()}
					</Text>
					<Button
						disabled={busy}
						onClick={() => navigateAway(() => router.push(LISTING_PATH))}
					>
						Discard
					</Button>
					{mayUpdate && (
						<Button
							type="primary"
							htmlType="submit"
							loading={saving}
							disabled={busy || !dirty}
						>
							Save changes
						</Button>
					)}
				</footer>
			</Form>
		</section>
	);
}

