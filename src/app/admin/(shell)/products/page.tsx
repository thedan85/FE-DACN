import type { Metadata } from "next";
import { Suspense } from "react";

import { ProductsListing } from "@/features/products/admin/components/products-listing";
import { CatalogListSkeleton } from "@/features/products/admin/components/catalog-skeleton";

export const metadata: Metadata = {
	title: "Products & Variants",
};

/**
 * The listing reads its filters from the URL, so it needs a Suspense boundary:
 * `useSearchParams` opts the subtree out of static rendering, and without a
 * fallback the whole route would be client-rendered.
 */
export default function AdminProductsPage() {
	return (
		<Suspense fallback={<CatalogListSkeleton />}>
			<ProductsListing />
		</Suspense>
	);
}
