"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { App, Button, Card, Pagination, Table, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { EditOutlined } from "@ant-design/icons";

import { ApiError } from "@/lib/api/client";
import { formatVndPrice } from "@/features/products/storefront/model/product-format";
import { getCategories } from "@/features/products/api/products.api";
import type {
	Category,
	ProductDetail,
	ProductPage,
} from "@/features/products/types";

import {
	getAdminProductDetailBySlug,
	listAdminProducts,
} from "../api/products.api";
import {
	DEFAULT_LISTING_QUERY,
	LISTING_PAGE_SIZE,
	parseListingQuery,
	toApiPage,
	toListingHref,
	toListingSearchParams,
	type ListingQuery,
} from "../model/listing-query";
import { buildProductRow, type ProductRow } from "../model/product-row";
import { CATALOG_PERMISSIONS } from "../model/permissions";
import { useCatalogPermissions } from "../use-catalog-permissions";
import { CatalogToolbar } from "./catalog-toolbar";
import { CatalogEmptyState, CatalogErrorState } from "./catalog-states";
import { CatalogListSkeleton } from "./catalog-skeleton";
import { AdminCatalogTheme } from "./admin-catalog-theme";
import { StatusPill } from "./status-pill";
import styles from "./products-listing.module.css";

const { Title, Text } = Typography;

/** The listing route, where the sidebar's "Products & Variants" item points. */
const LISTING_PATH = "/admin/products";

type ListingState =
	| { status: "loading" }
	| { status: "error"; message: string; requestKey: string }
	| { status: "ready"; page: ProductPage; requestKey: string };

/**
 * Products & Variants listing.
 *
 * The URL is the state: filters and the page live in search params, so a
 * filtered view is shareable, survives a reload, and the back button works
 * without extra bookkeeping. `router.replace` rather than `push`, so typing a
 * search term does not fill the history stack with every keystroke.
 *
 * Fetching follows the repo's convention (`order-history-view`): a `requestKey`
 * fixes which query a response belongs to, and `setState` is only ever called
 * from an async callback. Loading is therefore *derived* — a result whose key
 * does not match the current query is stale, and renders as still loading —
 * instead of being a second piece of state that could disagree with the data.
 *
 * Expansion is where the contract gets awkward: `ProductResponse` has no
 * variant count and no SKU, so those two cells stay blank until that row's
 * detail aggregate is fetched. The detail is cached per slug for the life of
 * the page, so re-expanding a row costs nothing.
 */
export function ProductsListing() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	// Static `message.error` cannot see the app's ConfigProvider theme, so the
	// hook form is used (this is what the provider in `providers.tsx` is for).
	const { message } = App.useApp();
	const { can } = useCatalogPermissions();

	const query = useMemo(
		() => parseListingQuery(Object.fromEntries(searchParams.entries())),
		[searchParams],
	);

	const [state, setState] = useState<ListingState>({ status: "loading" });
	const [categories, setCategories] = useState<Category[]>([]);
	const [categoriesLoading, setCategoriesLoading] = useState(true);
	/**
	 * Bumped by the error state's retry. `router.refresh()` would re-render
	 * without re-running the fetch effect, because the effect depends only on the
	 * query — so the retry has to change something the effect actually watches.
	 */
	const [reloadKey, setReloadKey] = useState(0);

	/** Per-slug detail cache, so a row's variants load at most once. */
	const [details, setDetails] = useState<Record<string, ProductDetail>>({});
	const [loadingSlugs, setLoadingSlugs] = useState<Record<string, true>>({});
	const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

	const requestKey = JSON.stringify([
		query.status,
		query.sort,
		query.keyword,
		query.category,
		query.page,
		reloadKey,
	]);

	// An error belongs to the request that produced it, not to the filter, so it
	// only counts while its key still matches — otherwise changing a filter would
	// keep showing the previous failure until the new request resolved. Narrowing
	// on `"loading"` first makes `requestKey` available on the other two arms.
	const isFetching =
		state.status === "loading" || state.requestKey !== requestKey;

	useEffect(() => {
		let active = true;

		listAdminProducts({
			status: query.status,
			sort: query.sort,
			keyword: query.keyword,
			categoryId: query.category,
			page: toApiPage(query.page),
			size: LISTING_PAGE_SIZE,
		})
			.then((page) => {
				if (active) {
					setState({ status: "ready", page, requestKey });
				}
			})
			.catch((caught: unknown) => {
				if (!active) {
					return;
				}

				setState({
					status: "error",
					requestKey,
					message:
						caught instanceof ApiError && caught.status > 0
							? caught.message
							: "Could not reach the server. Check your connection and try again.",
				});
			});

		return () => {
			active = false;
		};
	}, [
		query.status,
		query.sort,
		query.keyword,
		query.category,
		query.page,
		requestKey,
	]);

	// The catalog's taxonomy changes rarely, so categories load once per mount.
	useEffect(() => {
		let active = true;

		getCategories()
			.then((result) => {
				if (active) {
					setCategories(result);
				}
			})
			.catch(() => {
				// A failed category fetch disables that filter, not the page: the
				// listing is still useful without it.
				if (active) {
					setCategories([]);
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

	const updateQuery = useCallback(
		(next: Partial<ListingQuery>) => {
			const merged: ListingQuery = { ...query, ...next };
			const search = new URLSearchParams(
				toListingSearchParams(merged),
			).toString();

			router.replace(search ? `${pathname}?${search}` : pathname);
		},
		[query, router, pathname],
	);

	const loadDetail = useCallback(
		async (slug: string) => {
			if (details[slug] || loadingSlugs[slug]) {
				return;
			}

			setLoadingSlugs((previous) => ({ ...previous, [slug]: true }));

			try {
				const detail = await getAdminProductDetailBySlug(slug);
				setDetails((previous) => ({ ...previous, [slug]: detail }));
			} catch {
				// The row's two unknown cells stay blank; the panel says so.
				message.error("Could not load this product's variants.");
			} finally {
				setLoadingSlugs((previous) => {
					const next = { ...previous };
					delete next[slug];
					return next;
				});
			}
		},
		[details, loadingSlugs, message],
	);

	const page = state.status === "ready" ? state.page : null;
	const rows = useMemo<ProductRow[]>(
		() => (page?.content ?? []).map((product) => buildProductRow(product, details[product.slug])),
		[page, details],
	);

	const columns = useMemo<TableColumnsType<ProductRow>>(
		() => [
			{
				title: "Product",
				key: "product",
				render: (_, row) => (
					<div className={styles.productCell}>
						{row.thumbnail ? (
							<Image
								className={styles.thumbnail}
								src={row.thumbnail}
								alt=""
								width={44}
								height={44}
								unoptimized
							/>
						) : (
							<span className={styles.thumbnailFallback} aria-hidden="true" />
						)}
						<span className={styles.productText}>
							<Link
								className={styles.productName}
								href={`${LISTING_PATH}/${row.slug}/edit`}
							>
								{row.name}
							</Link>
							{/* Unknown until this row's detail loads — see the class comment. */}
							{row.firstVariantSku !== null && (
								<span className={styles.productSku}>{row.firstVariantSku}</span>
							)}
						</span>
					</div>
				),
			},
			{
				title: "Category",
				key: "category",
				width: 140,
				render: (_, row) => <Text type="secondary">{row.categoryName ?? "—"}</Text>,
			},
			{
				title: "Variants",
				key: "variants",
				width: 96,
				render: (_, row) => (
					<Text type="secondary">
						{row.variantCount === null ? "—" : row.variantCount}
					</Text>
				),
			},
			{
				title: "Price range",
				key: "price",
				width: 150,
				render: (_, row) => row.priceRange ?? <Text type="secondary">—</Text>,
			},
			{
				title: "Stock",
				key: "stock",
				width: 90,
				render: (_, row) => row.stock,
			},
			{
				title: "Status",
				key: "status",
				width: 110,
				render: (_, row) => <StatusPill status={row.status} />,
			},
			{
				title: "Actions",
				key: "actions",
				width: 90,
				render: (_, row) => (
					// `href` on Button renders an anchor with the button styling:
					// wrapping a Button in a Link would nest one interactive element
					// inside another and give the row two tab stops.
					<Button
						type="link"
						href={`${LISTING_PATH}/${row.slug}/edit`}
						icon={<EditOutlined />}
						aria-label={`Edit ${row.name}`}
					/>
				),
			},
		],
		[],
	);

	const hasFilters =
		Boolean(query.keyword ?? query.category) ||
		query.status !== DEFAULT_LISTING_QUERY.status;
	const totalShown = page?.content.length ?? 0;
	const firstShown =
		totalShown === 0 ? 0 : (query.page - 1) * LISTING_PAGE_SIZE + 1;
	const lastShown = firstShown === 0 ? 0 : firstShown + totalShown - 1;

	return (
		<AdminCatalogTheme>
			<section className={styles.page}>
				<header className={styles.header}>
					<div>
						<Title level={1} className={styles.title}>
							Products &amp; Variants
						</Title>
						<Text type="secondary">
							Manage your catalog, variants and availability.
						</Text>
					</div>
					{/* `href` on Button renders an anchor, avoiding a Button nested in a
					    Link. Gated on the permission the backend enforces anyway, and
					    hidden until ticket 04 lands the create route, so the page never
					    offers an action that 404s. */}
					{can(CATALOG_PERMISSIONS.productCreate) && (
						<Button type="primary" href={`${LISTING_PATH}/new`}>
							Add product
						</Button>
					)}
				</header>

			<Card styles={{ body: { padding: 0 } }}>
				<CatalogToolbar
					query={query}
					onChange={updateQuery}
					categories={categories}
					categoriesLoading={categoriesLoading}
					onKeywordSubmit={(keyword) =>
						updateQuery({ keyword: keyword || undefined, page: 1 })
					}
				/>

				{state.status === "error" && !isFetching ? (
					<CatalogErrorState
						// Changing `reloadKey` is what actually re-runs the fetch effect;
						// `router.refresh()` would re-render without re-requesting.
						onRetry={() => setReloadKey((previous) => previous + 1)}
						message={state.message}
					/>
				) : isFetching ? (
					<CatalogListSkeleton />
				) : rows.length === 0 ? (
					<CatalogEmptyState
						hasFilters={hasFilters}
						// Resets to the *whole* default view, sort included: leaving a
						// non-default sort behind would mean "Clear filters" did not
						// return the page to the state the user started from.
						onClearFilters={() => router.replace(toListingHref(DEFAULT_LISTING_QUERY))}
					/>
				) : (
					<Table<ProductRow>
						rowKey="productId"
						dataSource={rows}
						columns={columns}
						pagination={false}
						expandable={{
							expandedRowKeys: expandedKeys,
							onExpand: (expanded, record) => {
								setExpandedKeys((previous) =>
									expanded
										? [...previous, record.productId]
										: previous.filter((key) => key !== record.productId),
								);

								if (expanded) {
									void loadDetail(record.slug);
								}
							},
							expandedRowRender: (record) => (
								<VariantPanel
									detail={details[record.slug]}
									loading={Boolean(loadingSlugs[record.slug])}
									productName={record.name}
								/>
							),
						}}
					/>
				)}

				{state.status === "ready" && !isFetching && page !== null && page.totalElements > 0 && (
					<footer className={styles.pagination}>
						<Text type="secondary" aria-live="polite">
							Showing {firstShown}–{lastShown} of {page.totalElements} products
						</Text>
						{/* antd's own Pagination, in `simple` mode: a page box and two
						    arrows. The design's numbered control with a `…` collapse is
						    more chrome than a six-page list needs, and `simple` is the prop
						    that expresses that — no hand-rolled control is warranted. */}
						<Pagination
							size="small"
							current={query.page}
							total={page.totalElements}
							pageSize={LISTING_PAGE_SIZE}
							showSizeChanger={false}
							simple
							onChange={(next) => updateQuery({ page: next })}
						/>
					</footer>
				)}
				</Card>
			</section>
		</AdminCatalogTheme>
	);
}

type VariantPanelProps = {
	detail: ProductDetail | undefined;
	loading: boolean;
	productName: string;
};

/**
 * The expanded row: this product's variants.
 *
 * Rendered only from the detail aggregate, because that is the only response
 * carrying variants. While it loads, the panel says so rather than showing an
 * empty table, which would read as "this product has no variants".
 */
function VariantPanel({ detail, loading, productName }: VariantPanelProps) {
	if (loading || detail === undefined) {
		return (
			<div className={styles.variantPanel}>
				<Text type="secondary">Loading variants…</Text>
			</div>
		);
	}

	if (detail.variants.length === 0) {
		return (
			<div className={styles.variantPanel}>
				<Text type="secondary">{productName} has no variants yet.</Text>
			</div>
		);
	}

	const totalStock = detail.variants.reduce(
		(sum, variant) => sum + (variant.stock ?? 0),
		0,
	);

	return (
		<div className={styles.variantPanel}>
			<div className={styles.variantHeader}>
				<Text strong>
					{productName} · {detail.variants.length}{" "}
					{detail.variants.length === 1 ? "variant" : "variants"}
				</Text>
				<Text type="secondary">Total stock: {totalStock}</Text>
			</div>

			<ul className={styles.variantList}>
				{detail.variants.map((variant) => (
					<li className={styles.variantRow} key={variant.variantId}>
						<span className={styles.variantSkus}>
							<span className={styles.variantSku}>{variant.sku}</span>
							{variant.attributes.length > 0 && (
								<span className={styles.variantAttrs}>
									{variant.attributes
										.map(
											(attribute) =>
												`${attribute.attributeName}: ${attribute.attributeValue}`,
										)
										.join(" · ")}
								</span>
							)}
						</span>
						<span className={styles.variantPrice}>
							{formatVndPrice(variant.price)}
						</span>
						<span className={styles.variantStock}>
							{variant.stock ?? 0} in stock
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
