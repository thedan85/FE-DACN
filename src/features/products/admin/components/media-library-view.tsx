"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
	Alert,
	App,
	Button,
	Card,
	Form,
	Input,
	Modal,
	Pagination,
	Popconfirm,
	Select,
	Space,
	Table,
	Tooltip,
	Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
	DeleteOutlined,
	EditOutlined,
	LinkOutlined,
	PlusOutlined,
} from "@ant-design/icons";

import {
	ADMIN_SESSION_REFRESHED_MESSAGE,
	adminAuthFailureFeedback,
	handleAdminAuthFailure,
	recoveredAdminSession,
} from "@/features/auth/admin/model/admin-auth-failure";
import { AccessDeniedState } from "@/components/feedback/access-denied-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import type { Media, PageData, Product } from "@/features/products/types";
import type { ProductStatus } from "@/types";
import {
	STORE_TIME_ZONE,
	formatDate,
} from "@/features/products/storefront/model/product-format";

import {
	createAdminMedia,
	deleteAdminMedia,
	listAdminMedia,
	patchAdminMedia,
	type MediaOwner,
} from "../api/media.api";
import {
	getAdminProductDetailBySlug,
	listAdminProducts,
} from "../api/products.api";
import { apiErrorMessage, isNotFound } from "../model/api-error";
import {
	MEDIA_URL_MAX_LENGTH,
	mediaPreviewKind,
	ownerLabel,
	validateMediaUrl,
} from "../model/media";
import { mediaDeleteEnabled } from "../model/media-library-release";
import { CATALOG_PERMISSIONS } from "../model/permissions";
import { useCatalogPermissions } from "../use-catalog-permissions";
import { useDialogFocusRestore } from "@/hooks/use-dialog-focus-restore";
import { AdminCatalogTheme } from "./admin-catalog-theme";
import styles from "./media-library-view.module.css";

const { Title, Text } = Typography;

const PAGE_SIZE = 20;

/** Same debounce and keyword cap as the order search: no new dependency. */
const PRODUCT_SEARCH_DEBOUNCE_MS = 300;
const MAX_PRODUCT_KEYWORD_LENGTH = 100;

const PRODUCT_STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
	{ value: "ACTIVE", label: "Active" },
	{ value: "DRAFT", label: "Draft" },
	{ value: "INACTIVE", label: "Inactive" },
];

type OwnerKind = "all" | "product" | "variant";

type ListState =
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string }
	/** The chosen filter has no owner yet, so there is nothing to read. */
	| { status: "prompt" }
	| { status: "ready"; page: PageData<Media> };

/**
 * The media library.
 *
 * One paged list, scoped by an owner filter: nothing (the global `GET
 * /media`), a product (`GET /products/{id}/media`, which falls back to the
 * variant-owned rows when the product has no direct media — rows are labelled
 * from their returned owner, never from the filter), or one variant (exact).
 * Reads carry no permission gate — the route itself is company-account only —
 * while create/edit/delete stay gated on `media:create|update|delete`.
 *
 * Delete is additionally behind the `mediaDeleteEnabled` release constant
 * (Task 9 flips it after the thumbnail check): while it is `false`, the row
 * action renders disabled and its confirmation never opens.
 */
export function MediaLibraryView() {
	const router = useRouter();
	const { can } = useCatalogPermissions();

	const mayCreate = can(CATALOG_PERMISSIONS.mediaCreate);
	const mayUpdate = can(CATALOG_PERMISSIONS.mediaUpdate);
	const mayDelete = can(CATALOG_PERMISSIONS.mediaDelete);

	const [ownerKind, setOwnerKind] = useState<OwnerKind>("all");
	const [productId, setProductId] = useState<string | null>(null);
	const [variantId, setVariantId] = useState<string | null>(null);
	const [page, setPage] = useState(0);
	const [state, setState] = useState<ListState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);
	const [formTarget, setFormTarget] = useState<
		{ mode: "create" } | { mode: "edit"; media: Media } | null
	>(null);

	const { headingRef, captureTrigger, requestFocusRestore } =
		useDialogFocusRestore({
			settled: state.status !== "loading",
			anyDialogOpen: formTarget !== null,
			settleSignal: state,
		});

	const reload = useCallback(() => setReloadKey((key) => key + 1), []);

	// Rebuilt inside the effect so the dependency list can name the
	// primitives instead of a fresh object each render.
	const ownerReady =
		ownerKind === "all" ||
		(ownerKind === "product" && productId !== null) ||
		(ownerKind === "variant" && productId !== null && variantId !== null);

	useEffect(() => {
		if (!ownerReady) {
			setState({ status: "prompt" });
			return;
		}

		const owner: MediaOwner | undefined =
			ownerKind === "product" && productId
				? { productId }
				: ownerKind === "variant" && variantId
					? { variantId }
					: undefined;

		let active = true;
		setState({ status: "loading" });

		listAdminMedia({ page, size: PAGE_SIZE, ...(owner ? { owner } : {}) })
			.then((result) => {
				if (active) {
					setState({ status: "ready", page: result });
				}
			})
			.catch(async (caught: unknown) => {
				if (!active) {
					return;
				}

				// Hide any protected payload while the session is rechecked.
				setState({ status: "loading" });
				const outcome = await handleAdminAuthFailure(caught, router);

				if (!active) {
					return;
				}

				const message = apiErrorMessage(
					caught,
					"Could not reach the server. Check your connection and try again.",
				);
				const recovered = recoveredAdminSession(outcome);

				if (outcome === "unhandled" || recovered) {
					// A recovered 401 is not a denial: offer a manual read retry.
					// No read is replayed and no write is ever replayed here.
					setState({
						status: "error",
						message: recovered
							? `${ADMIN_SESSION_REFRESHED_MESSAGE} ${message}`
							: message,
					});
					return;
				}

				// Denied read: the helper redirected (401) or refreshed
				// permissions (403); no data is left on screen.
				setState({ status: "forbidden" });
			});

		return () => {
			active = false;
		};
	}, [ownerReady, ownerKind, productId, variantId, page, reloadKey, router]);

	const readyPage = state.status === "ready" ? state.page : null;

	/**
	 * After a delete that emptied the current page, going back one page keeps
	 * the view valid (the deleted row was necessarily the last row there);
	 * anything else reloads the page the user is on.
	 */
	const handleDeleted = useCallback(() => {
		if (readyPage && readyPage.content.length === 1 && page > 0) {
			setPage((current) => Math.max(0, current - 1));
			return;
		}
		reload();
	}, [readyPage, page, reload]);

	const handleNotFound = useCallback(() => reload(), [reload]);

	const columns = useMemo<TableColumnsType<Media>>(
		() => [
			{
				title: "Preview",
				key: "preview",
				width: 88,
				render: (_, media) => <PreviewCell media={media} />,
			},
			{
				title: "URL",
				key: "url",
				render: (_, media) => (
					<span className={styles.urlCell} title={media.url}>
						{media.url}
					</span>
				),
			},
			{
				title: "Owner",
				key: "owner",
				width: 170,
				render: (_, media) => (
					<span className={styles.ownerCell}>{ownerLabel(media)}</span>
				),
			},
			{
				title: "Created",
				key: "createdAt",
				width: 150,
				render: (_, media) =>
					formatDate(media.createdAt, STORE_TIME_ZONE) ?? "—",
			},
			{
				title: "Actions",
				key: "actions",
				width: 120,
				render: (_, media) => (
					<Space size={4}>
						{mayUpdate && (
							<Button
								type="link"
								icon={<EditOutlined />}
								aria-label={`Edit media ${media.mediaId}`}
								onClick={(event) => {
									captureTrigger(event);
									setFormTarget({ mode: "edit", media });
								}}
							/>
						)}
						{mayDelete && (
							<DeleteMediaButton
								media={media}
								onDeleted={handleDeleted}
								onNotFound={handleNotFound}
							/>
						)}
					</Space>
				),
			},
		],
		[mayUpdate, mayDelete, handleDeleted, handleNotFound, captureTrigger],
	);

	const promptText =
		ownerKind === "variant"
			? "Pick the product and one of its variants to see their media."
			: "Pick a product to see its media — including the variant-owned rows it falls back to.";

	return (
		<AdminCatalogTheme>
			<section className={styles.page}>
				<header className={styles.header}>
					<div>
						<Title level={1} className={styles.title} ref={headingRef} tabIndex={-1}>
							Media
						</Title>
						<Text type="secondary">
							The hosted images attached to products and variants.
						</Text>
					</div>
					{mayCreate && (
						<Button
							type="primary"
							icon={<PlusOutlined />}
							onClick={(event) => {
								captureTrigger(event);
								setFormTarget({ mode: "create" });
							}}
						>
							Add media
						</Button>
					)}
				</header>

				<Card styles={{ body: { padding: 0 } }}>
					<div className={styles.toolbar}>
						<OwnerFields
							mode="filter"
							enabled={ownerKind !== "all"}
							kind={ownerKind}
							onKindChange={(next) => {
								setOwnerKind(next);
								setPage(0);
							}}
							productId={productId}
							onProductChange={(next) => {
								setProductId(next);
								setPage(0);
							}}
							variantId={variantId}
							onVariantChange={(next) => {
								setVariantId(next);
								setPage(0);
							}}
						/>
					</div>

					{state.status === "prompt" ? (
						<EmptyState title="Choose an owner" description={promptText} />
					) : state.status === "forbidden" ? (
						<AccessDeniedState
							title="You do not have access to media"
							description="Ask an administrator to restore your access to the admin portal."
						/>
					) : state.status === "error" ? (
						<ErrorState
							title="We couldn't load media"
							description={state.message}
							retryLabel="Try again"
							onRetry={reload}
						/>
					) : state.status === "loading" ? (
						<LoadingState rows={6} label="Loading media" />
					) : readyPage !== null && readyPage.content.length === 0 ? (
						<EmptyState
							title="No media here yet"
							description={
								ownerKind === "all"
									? "Add the first hosted image to the catalog."
									: "This selection has no media rows."
							}
							action={
								mayCreate ? (
									<Button
										type="primary"
										onClick={(event) => {
											captureTrigger(event);
											setFormTarget({ mode: "create" });
										}}
									>
										Add media
									</Button>
								) : undefined
							}
						/>
					) : (
						<Table<Media>
							rowKey={(media) => media.mediaId}
							dataSource={readyPage?.content ?? []}
							columns={columns}
							pagination={false}
						/>
					)}

					{readyPage !== null && readyPage.totalElements > 0 && (
						<footer className={styles.pagination}>
							<Pagination
								size="small"
								current={page + 1}
								total={readyPage.totalElements}
								pageSize={PAGE_SIZE}
								showSizeChanger={false}
								onChange={(next) => setPage(Math.max(0, next - 1))}
							/>
						</footer>
					)}
				</Card>
			</section>

			{formTarget && (
				<MediaFormModal
					key={
						formTarget.mode === "edit"
							? formTarget.media.mediaId
							: "new"
					}
					initial={formTarget.mode === "edit" ? formTarget.media : null}
					onCancel={() => {
						requestFocusRestore();
						setFormTarget(null);
					}}
					onSaved={() => {
						requestFocusRestore();
						setFormTarget(null);
						reload();
					}}
				/>
			)}
		</AdminCatalogTheme>
	);
}

type OwnerFieldsProps = {
	/**
	 * `filter` adds the "All media" choice and stays inert on it; `create`
	 * has no such choice and always stays live.
	 */
	mode: "filter" | "create";
	/** False keeps the selects mounted but hidden (the "All media" filter). */
	enabled: boolean;
	kind: OwnerKind;
	onKindChange: (next: OwnerKind) => void;
	productId: string | null;
	onProductChange: (next: string | null) => void;
	variantId: string | null;
	onVariantChange: (next: string | null) => void;
};

/**
 * The shared owner picker: which product (and — for the variant choice —
 * which of its variants) a media row belongs to.
 *
 * Product lookup defaults to `ACTIVE`; `DRAFT`/`INACTIVE` unlock only with
 * `product:create`. Picking a product clears any previously chosen variant,
 * and changing the owner kind clears both — an owner can never leak across
 * kinds, so the create body carries exactly one owner.
 */
function OwnerFields({
	mode,
	enabled,
	kind,
	onKindChange,
	productId,
	onProductChange,
	variantId,
	onVariantChange,
}: OwnerFieldsProps) {
	const { can } = useCatalogPermissions();
	const maySeeHidden = can(CATALOG_PERMISSIONS.productCreate);

	const {
		status,
		setStatus,
		setKeyword,
		setDebouncedKeyword,
		keywordTooLong,
		state: productsState,
		reload: reloadProducts,
	} = useProductOptions(enabled && kind !== "all");

	const products = useMemo(
		() =>
			productsState.status === "ready" ? productsState.products : [],
		[productsState],
	);
	// Remember the chosen row so its label and variants survive an option
	// refresh (a keyword search need not include it).
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

	useEffect(() => {
		const match = products.find((product) => product.productId === productId);

		if (match) {
			setSelectedProduct(match);
		}
	}, [products, productId]);

	// Losing product:create pins the lookup to ACTIVE and drops any hidden
	// owner that could no longer be shown or submitted.
	const wasAllowed = useRef(maySeeHidden);

	useEffect(() => {
		if (wasAllowed.current && !maySeeHidden) {
			setStatus("ACTIVE");
			setKeyword("");
			setDebouncedKeyword("");
			setSelectedProduct(null);
			onProductChange(null);
			onVariantChange(null);
		}
		wasAllowed.current = maySeeHidden;
	}, [
		maySeeHidden,
		setStatus,
		setKeyword,
		setDebouncedKeyword,
		onProductChange,
		onVariantChange,
	]);

	const { state: variantsState, reload: reloadVariants } =
		useVariantOptions(kind === "variant" ? selectedProduct : null);

	const productOptions = useMemo(() => {
		const options = products.map((product) => ({
			value: product.productId,
			label: product.name,
		}));

		// Keep the selection visible while options refresh from the backend.
		if (
			productId &&
			!options.some((option) => option.value === productId)
		) {
			options.unshift({
				value: productId,
				label: selectedProduct?.name ?? productId,
			});
		}

		return options;
	}, [products, productId, selectedProduct]);

	const variantOptions =
		variantsState.status === "ready" ? variantsState.variants : [];

	return (
		<>
			<Select
				className={styles.select}
				aria-label={mode === "filter" ? "Owner filter" : "Owner type"}
				value={kind}
				options={
					mode === "filter"
						? [
								{ value: "all", label: "All media" },
								{ value: "product", label: "Product" },
								{ value: "variant", label: "Variant" },
							]
						: [
								{ value: "product", label: "Product" },
								{ value: "variant", label: "Variant" },
							]
				}
				onChange={(value: OwnerKind) => {
					// Any old choice is discarded with the kind, so a variant
					// picked before switching to Product never leaks into the
					// submit body (and vice versa).
					onKindChange(value);
					onProductChange(null);
					onVariantChange(null);
					setSelectedProduct(null);
					setKeyword("");
					setDebouncedKeyword("");
				}}
			/>
			{enabled && maySeeHidden && (
				<Select
					className={styles.select}
					aria-label="Product status"
					value={status}
					options={PRODUCT_STATUS_OPTIONS}
					onChange={(value: ProductStatus) => {
						// A product picked under one status need not exist under
						// another, so the query and the whole owner scope reset.
						setStatus(value);
						setKeyword("");
						setDebouncedKeyword("");
						setSelectedProduct(null);
						onProductChange(null);
						onVariantChange(null);
					}}
				/>
			)}
			{enabled &&
				(productsState.status === "error" ? (
					<Alert
						type="error"
						showIcon
						title="Couldn't load products"
						className={styles.notice}
						action={
							<Button size="small" onClick={reloadProducts}>
								Retry
							</Button>
						}
					/>
				) : (
					<Select
						className={styles.selectWide}
						aria-label="Product"
						// Search runs on the backend so products past the first
						// page are reachable; local option filtering is off.
						showSearch={{ filterOption: false, onSearch: setKeyword }}
						notFoundContent={
							keywordTooLong
								? `Search must be at most ${MAX_PRODUCT_KEYWORD_LENGTH} characters.`
								: undefined
						}
						placeholder="Choose a product"
						loading={productsState.status === "loading"}
						value={productId ?? undefined}
						allowClear
						options={productOptions}
						onChange={(value?: string) => {
							onProductChange(value ?? null);
							onVariantChange(null);
						}}
					/>
				))}
			{enabled &&
				kind === "variant" &&
				(variantsState.status === "error" ? (
					<Alert
						type="error"
						showIcon
						title="Couldn't load variants"
						className={styles.notice}
						action={
							<Button size="small" onClick={reloadVariants}>
								Retry
							</Button>
						}
					/>
				) : (
					<Select
						className={styles.select}
						aria-label="Variant"
						placeholder={
							productId ? "Choose a variant" : "Choose a product first"
						}
						disabled={!productId || variantsState.status === "loading"}
						loading={variantsState.status === "loading"}
						value={variantId ?? undefined}
						options={variantOptions}
						onChange={(value?: string) => onVariantChange(value ?? null)}
					/>
				))}
		</>
	);
}

type ProductOptionsState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "error" }
	| { status: "ready"; products: Product[] };

function useProductOptions(enabled: boolean) {
	const router = useRouter();
	const { can } = useCatalogPermissions();
	const maySeeHidden = can(CATALOG_PERMISSIONS.productCreate);

	const [status, setStatus] = useState<ProductStatus>("ACTIVE");
	const [keyword, setKeyword] = useState("");
	const [debouncedKeyword, setDebouncedKeyword] = useState("");
	const keywordTooLong = keyword.trim().length > MAX_PRODUCT_KEYWORD_LENGTH;
	const [state, setState] = useState<ProductOptionsState>({ status: "idle" });
	const [reloadKey, setReloadKey] = useState(0);
	const requestRef = useRef(0);

	// Without the permission the lookup is pinned to ACTIVE even if the
	// status state somehow drifted (e.g. permissions changed mid-session).
	const effectiveStatus: ProductStatus = maySeeHidden ? status : "ACTIVE";

	// Debounce the backend search so typing does not flood the API.
	useEffect(() => {
		if (keywordTooLong || keyword.trim() === debouncedKeyword) {
			return;
		}
		const timer = window.setTimeout(() => {
			setDebouncedKeyword(keyword.trim());
		}, PRODUCT_SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [keyword, debouncedKeyword, keywordTooLong]);

	useEffect(() => {
		if (!enabled) {
			requestRef.current += 1;
			setState({ status: "idle" });
			return;
		}

		const requestId = ++requestRef.current;
		let active = true;

		setState({ status: "loading" });

		listAdminProducts({
			status: effectiveStatus,
			keyword: debouncedKeyword || undefined,
			page: 0,
			size: 100,
		})
			.then((result) => {
				if (!active || requestRef.current !== requestId) {
					return;
				}
				setState({ status: "ready", products: result.content });
			})
			.catch(async (caught: unknown) => {
				if (!active) {
					return;
				}

				await handleAdminAuthFailure(caught, router);

				if (!active || requestRef.current !== requestId) {
					return;
				}

				setState({ status: "error" });
			});

		return () => {
			active = false;
		};
	}, [enabled, effectiveStatus, debouncedKeyword, reloadKey, router]);

	const reload = useCallback(() => setReloadKey((key) => key + 1), []);

	return {
		status: effectiveStatus,
		setStatus,
		setKeyword,
		setDebouncedKeyword,
		keywordTooLong,
		state,
		reload,
	};
}

type VariantOptionsState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "error" }
	| { status: "ready"; variants: { value: string; label: string }[] };

function useVariantOptions(product: Product | null) {
	const router = useRouter();
	const [state, setState] = useState<VariantOptionsState>({ status: "idle" });
	const [reloadKey, setReloadKey] = useState(0);
	const requestRef = useRef(0);
	const slug = product?.slug ?? null;

	useEffect(() => {
		if (!slug) {
			requestRef.current += 1;
			setState({ status: "idle" });
			return;
		}

		const requestId = ++requestRef.current;
		let active = true;

		setState({ status: "loading" });

		getAdminProductDetailBySlug(slug)
			.then((detail) => {
				if (!active || requestRef.current !== requestId) {
					return;
				}

				setState({
					status: "ready",
					variants: detail.variants.map((variant) => ({
						value: variant.variantId,
						label: variant.sku,
					})),
				});
			})
			.catch(async (caught: unknown) => {
				if (!active) {
					return;
				}

				await handleAdminAuthFailure(caught, router);

				if (!active || requestRef.current !== requestId) {
					return;
				}

				setState({ status: "error" });
			});

		return () => {
			active = false;
		};
	}, [slug, reloadKey, router]);

	const reload = useCallback(() => setReloadKey((key) => key + 1), []);

	return { state, reload };
}

function PreviewCell({ media }: { media: Media }) {
	const [broken, setBroken] = useState(false);
	const preview = mediaPreviewKind(media.url);

	if (preview.kind === "image" && !broken) {
		return (
			<span className={styles.thumb}>
				<Image
					src={media.url}
					alt={`Preview of media ${media.mediaId}`}
					fill
					sizes="64px"
					unoptimized
					className={styles.thumbImage}
					onError={() => setBroken(true)}
				/>
			</span>
		);
	}

	if (preview.kind === "link" || (preview.kind === "image" && broken)) {
		const href = preview.kind === "link" ? preview.href : media.url;
		let host = "";

		try {
			host = new URL(href).hostname;
		} catch {
			host = "";
		}

		return (
			<a
				className={styles.externalLink}
				href={href}
				target="_blank"
				rel="noreferrer"
			>
				<LinkOutlined aria-hidden />
				External: {host || "image"}
			</a>
		);
	}

	// A `javascript:` or malformed URL renders neither image nor link.
	return <Text type="secondary">Preview unavailable</Text>;
}

type DeleteMediaButtonProps = {
	media: Media;
	onDeleted: (media: Media) => void;
	onNotFound: () => void;
};

function DeleteMediaButton({
	media,
	onDeleted,
	onNotFound,
}: DeleteMediaButtonProps) {
	const router = useRouter();
	const { message } = App.useApp();
	const [deleting, setDeleting] = useState(false);

	const button = (
		<Button
			danger
			type="link"
			icon={<DeleteOutlined />}
			aria-label={`Delete media ${media.mediaId}`}
			disabled={!mediaDeleteEnabled || deleting}
			loading={deleting}
		/>
	);

	if (!mediaDeleteEnabled) {
		// A disabled button emits no pointer events, so the wrapper span keeps
		// the explanation reachable by hover and keyboard focus.
		return (
			<Tooltip title="Deleting is disabled until the thumbnail check ships.">
				<span tabIndex={0}>{button}</span>
			</Tooltip>
		);
	}

	const confirmDelete = async () => {
		if (deleting) {
			return;
		}

		setDeleting(true);

		try {
			await deleteAdminMedia(media.mediaId);
			message.success(`Deleted media ${media.mediaId}.`);
			onDeleted(media);
		} catch (caught) {
			const outcome = await handleAdminAuthFailure(caught, router);

			if (outcome === "unhandled") {
				if (isNotFound(caught)) {
					// Another session already deleted it — refresh instead of
					// retrying or surfacing a stale-row error.
					message.info("That media row was already gone. The list was refreshed.");
					onNotFound();
				} else {
					message.error(
						apiErrorMessage(
							caught,
							`Could not delete media ${media.mediaId}.`,
						),
					);
				}
			} else {
				const feedback = adminAuthFailureFeedback(outcome);
				if (feedback !== null) {
					message.error(feedback);
				}
			}
		} finally {
			setDeleting(false);
		}
	};

	return (
		<Popconfirm
			title={`Delete media ${media.mediaId}?`}
			description={`This removes the row for ${media.url}. The image may disappear from product and variant rendering. This cannot be undone from the portal.`}
			okText="Delete media"
			okButtonProps={{ danger: true, disabled: deleting }}
			cancelText="Cancel"
			disabled={deleting}
			onConfirm={() => void confirmDelete()}
		>
			{button}
		</Popconfirm>
	);
}

type MediaFormValues = {
	url: string;
};

type MediaFormModalProps = {
	/** Null opens the create form; a row opens the URL edit form for it. */
	initial: Media | null;
	onCancel: () => void;
	onSaved: () => void;
};

function MediaFormModal({ initial, onCancel, onSaved }: MediaFormModalProps) {
	const router = useRouter();
	const { message } = App.useApp();
	const [form] = Form.useForm<MediaFormValues>();
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const [kind, setKind] = useState<"product" | "variant">(
		initial?.variantId ? "variant" : "product",
	);
	const [productId, setProductId] = useState<string | null>(
		initial?.productId ?? null,
	);
	const [variantId, setVariantId] = useState<string | null>(
		initial?.variantId ?? null,
	);

	const handleFinish = async (values: MediaFormValues) => {
		// The submit guard is belt and braces: Enter and Ok both reach here.
		if (saving) {
			return;
		}

		const url = values.url.trim();

		if (!initial) {
			const owner: MediaOwner | null =
				kind === "product"
					? productId
						? { productId }
						: null
					: variantId
						? { variantId }
						: null;

			if (owner === null) {
				// Exactly one owner at submit time.
				setFormError(
					kind === "product"
						? "Choose a product for this row."
						: "Choose a variant for this row.",
				);
				return;
			}

			setSaving(true);
			setFormError(null);

			try {
				await createAdminMedia({ url, ...owner });
				message.success("Media created.");
				onSaved();
			} catch (caught) {
				await handleAdminAuthFailure(caught, router);
				setFormError(apiErrorMessage(caught, "Could not save the media row."));
				setSaving(false);
			}
			return;
		}

		setSaving(true);
		setFormError(null);

		try {
			await patchAdminMedia(initial.mediaId, { url });
			message.success("Media saved.");
			onSaved();
		} catch (caught) {
			await handleAdminAuthFailure(caught, router);
			setFormError(apiErrorMessage(caught, "Could not save the media row."));
			setSaving(false);
		}
	};

	return (
		<Modal
			open
			title={initial ? "Edit media" : "Add media"}
			okText="Save media"
			cancelText="Cancel"
			confirmLoading={saving}
			onOk={() => form.submit()}
			onCancel={() => {
				if (!saving) {
					onCancel();
				}
			}}
			okButtonProps={{ disabled: saving }}
			cancelButtonProps={{ disabled: saving }}
			closable={!saving}
			keyboard={!saving}
			mask={{ closable: false }}
			destroyOnHidden
		>
			{formError && (
				<Alert
					type="error"
					showIcon
					title="Couldn't save the media"
					description={formError}
					className={styles.formError}
				/>
			)}
			<Form<MediaFormValues>
				form={form}
				layout="vertical"
				requiredMark
				scrollToFirstError={{ focus: true }}
				initialValues={{ url: initial?.url ?? "" }}
				onFinish={(values) => void handleFinish(values)}
			>
				{!initial && (
					<OwnerFields
						mode="create"
						enabled
						kind={kind}
						onKindChange={(next) => {
							if (next === "product" || next === "variant") {
								setKind(next);
							}
						}}
						productId={productId}
						onProductChange={setProductId}
						variantId={variantId}
						onVariantChange={setVariantId}
					/>
				)}
				<Form.Item
					name="url"
					label="Image URL"
					rules={[
						{ required: true, whitespace: true, message: "Enter the image URL." },
						{ max: MEDIA_URL_MAX_LENGTH, message: `The URL must be ${MEDIA_URL_MAX_LENGTH} characters or fewer.` },
						{
							validator: (_, value: string) => {
								const problem = validateMediaUrl(value ?? "");
								return problem === null
									? Promise.resolve()
									: Promise.reject(new Error(problem));
							},
						},
					]}
				>
					<Input autoComplete="off" placeholder="https://…" />
				</Form.Item>
			</Form>
		</Modal>
	);
}
