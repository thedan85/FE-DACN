import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/feedback/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import {
	getCategories,
	listProducts,
} from "@/features/products/api/products.api";
import { ProductGrid } from "@/features/products/storefront/components/product-grid";
import { ProductPagination } from "@/features/products/storefront/components/product-pagination";
import { ProductSidebar } from "@/features/products/storefront/components/product-sidebar";
import { ProductToolbar } from "@/features/products/storefront/components/product-toolbar";
import {
	getChildCategories,
	findCategoryBySlug,
} from "@/features/products/storefront/model/category-tree";
import {
	parseProductSearchParams,
	PRODUCTS_PAGE_SIZE,
	toSearchPath,
} from "@/features/products/storefront/model/product-search-params";
import { toApiSort } from "@/features/products/storefront/model/product-sort";
import type { Category } from "@/features/products/types";

import styles from "./products.module.css";

export const metadata: Metadata = {
	title: "Products",
	description: "Browse fish, aquatic plants, equipment and accessories.",
};

const ACTIVE_STATUS = "ACTIVE";

function getEmptyCopy(
	query: ReturnType<typeof parseProductSearchParams>,
	activeCategory: Category | undefined,
	childCategoryCount: number,
): { title: string; description: string } {
	if (query.name && !query.category) {
		return {
			title: `No products match \u201C${query.name}\u201D`,
			description:
				"Try a different search term, or clear the search to browse everything.",
		};
	}

	if (query.category) {
		return {
			title: `No products in ${activeCategory?.name ?? "this category"}`,
			description:
				childCategoryCount > 0
					? "This category has no products yet. Try one of its subcategories:"
					: "This category has no products right now.",
		};
	}

	if (query.minPrice != null || query.maxPrice != null) {
		return {
			title: "No products in this price range",
			description: "Adjust or clear the price filter to see more products.",
		};
	}

	return {
		title: "No products yet",
		description: "Products will appear here once they are available.",
	};
}

export default async function ProductsPage(props: PageProps<"/products">) {
	const rawSearchParams = await props.searchParams;
	const query = parseProductSearchParams(rawSearchParams);

	// D2: the page survives a category failure (sidebar degrades); a product
	// failure is thrown and handled by the segment error boundary.
	const [productsResult, categoriesResult] = await Promise.allSettled([
		listProducts({
			keyword: query.name,
			categoryId: query.category,
			minPrice: query.minPrice,
			maxPrice: query.maxPrice,
			sort: toApiSort(query.sort),
			// D9: the endpoint has no status filter yet (defect N1) and ignores
			// this today; it is sent so it works once the backend honors it.
			status: ACTIVE_STATUS,
			page: query.page - 1,
			size: PRODUCTS_PAGE_SIZE,
		}),
		getCategories(),
	]);

	if (productsResult.status === "rejected") {
		throw productsResult.reason;
	}

	const pageData = productsResult.value;

	let categories: Category[] | null = null;
	if (categoriesResult.status === "fulfilled") {
		categories = categoriesResult.value;
	} else {
		console.warn("Categories unavailable; sidebar degraded:", categoriesResult.reason);
	}

	const activeCategory =
		categories && query.category
			? findCategoryBySlug(categories, query.category)
			: undefined;

	const heading = activeCategory?.name ?? "All products";
	const count = pageData.totalElements;
	const isEmpty = count === 0;
	const isOutOfRange = count > 0 && pageData.content.length === 0;
	const priceActive = query.minPrice != null || query.maxPrice != null;
	const hasAnyFilter =
		Boolean(query.name) || Boolean(query.category) || priceActive;
	const childCategories =
		activeCategory && categories
			? getChildCategories(categories, activeCategory.categoryId)
			: [];

	const emptyCopy = getEmptyCopy(query, activeCategory, childCategories.length);
	const hasEmptyActions =
		childCategories.length > 0 || hasAnyFilter;

	return (
		<section className={`page-container ${styles.root}`}>
			<SectionHeading level={1} eyebrow="Shop" title={heading} />

			<div className={styles.card}>
				<div className={styles.controls}>
					{/* Static text stays plain markup: antd ships "use client", so
					    nested accesses like Typography.Text are undefined in a
					    server component (only direct imports survive RSC). */}
					<p className={styles.summary}>
						<strong>{heading}</strong>{" "}
						<span>
							({count} {count === 1 ? "product" : "products"} available)
						</span>
					</p>

					<ProductToolbar query={query} />
				</div>

				<div className={styles.body}>
					{categories ? (
						<ProductSidebar categories={categories} query={query} />
					) : (
						<aside className={styles.sidebarNotice}>
							Category filters are temporarily unavailable.
						</aside>
					)}

					<div className={styles.results}>
						{isEmpty ? (
							<EmptyState
								title={emptyCopy.title}
								description={emptyCopy.description}
								action={
									hasEmptyActions ? (
										<div className={styles.emptyActions}>
											{childCategories.map((child) => (
												<Link
													key={child.categoryId}
													href={toSearchPath({
														...query,
														category: child.slug,
														page: 1,
													})}
												>
													{child.name}
												</Link>
											))}

											{query.name && (
												<Link
													href={toSearchPath({
														...query,
														name: undefined,
														page: 1,
													})}
												>
													Clear search
												</Link>
											)}

											{priceActive && (
												<Link
													href={toSearchPath({
														...query,
														minPrice: undefined,
														maxPrice: undefined,
														page: 1,
													})}
												>
													Clear price
												</Link>
											)}

											{hasAnyFilter && (
												<Link
													href={toSearchPath({
														...query,
														name: undefined,
														category: undefined,
														minPrice: undefined,
														maxPrice: undefined,
														page: 1,
													})}
												>
													Show all products
												</Link>
											)}
										</div>
									) : undefined
								}
							/>
						) : isOutOfRange ? (
							<EmptyState
								title="Page out of range"
								description={`Results span ${pageData.totalPages} ${pageData.totalPages === 1 ? "page" : "pages"}.`}
								action={
									<div className={styles.emptyActions}>
										<Link
											href={toSearchPath({ ...query, page: 1 })}
										>
											Go to the first page
										</Link>
									</div>
								}
							/>
						) : (
							<>
								<ProductGrid products={pageData.content} />

								<ProductPagination
									query={query}
									page={query.page}
									pageSize={pageData.size || PRODUCTS_PAGE_SIZE}
									total={pageData.totalElements}
								/>
							</>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
