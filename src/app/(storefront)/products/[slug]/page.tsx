import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ApiError } from "@/lib/api/client";
import { getProductDetailBySlug } from "@/features/products/api/products.api";
import { ProductDetailView } from "@/features/products/storefront/components/product-detail-view";
import { parseProductSlug } from "@/features/products/storefront/model/product-detail-params";
import type { ProductDetail } from "@/features/products/types";

import styles from "./product-detail.module.css";

type ProductDetailPageProps = PageProps<"/products/[slug]">;

const DESCRIPTION_LIMIT = 160;

/**
 * Validates the route segment, fetches the aggregate once and maps a
 * missing/non-ACTIVE product to the not-found route.
 *
 * Wrapped in `React.cache` so `generateMetadata` and `page` share one loader
 * call (including the notFound() handling) in a render pass. Next also
 * memoizes identical GET fetches, so this is defensive rather than the only
 * dedupe; the public aggregate itself is data-cached for 30 seconds in
 * `getProductDetailBySlug`.
 */
export const loadProductDetail = cache(
	async (rawSlug: string | undefined): Promise<ProductDetail> => {
		const slug = parseProductSlug(rawSlug);

		if (!slug) {
			notFound();
		}

		let detail: ProductDetail;

		try {
			detail = await getProductDetailBySlug(slug);
		} catch (error) {
			// Unknown slug and hidden products are indistinguishable to an
			// anonymous caller — both are 404s, both render the not-found route.
			if (error instanceof ApiError && error.status === 404) {
				notFound();
			}

			throw error;
		}

		if (detail.product.status !== "ACTIVE") {
			notFound();
		}

		return detail;
	},
);

export async function generateMetadata(
	props: ProductDetailPageProps,
): Promise<Metadata> {
	const { slug } = await props.params;

	let detail: ProductDetail;

	try {
		detail = await loadProductDetail(slug);
	} catch {
		// The route itself reports the failure; metadata stays generic so a
		// transient backend error does not leak internals into the head.
		return { title: "Product" };
	}

	const { product } = detail;
	const description = product.description.slice(0, DESCRIPTION_LIMIT);

	return {
		title: product.name,
		description,
		openGraph: {
			title: product.name,
			description,
			type: "website",
			...(product.thumbnail
				? { images: [{ url: product.thumbnail }] }
				: {}),
		},
	};
}

export default async function ProductDetailPage(
	props: ProductDetailPageProps,
) {
	const { slug } = await props.params;
	const detail = await loadProductDetail(slug);

	return (
		<div className={styles.page}>
			<div className={`page-container ${styles.root}`}>
				<ProductDetailView
					product={detail.product}
					attributes={detail.attributes}
					variants={detail.variants}
					reviews={detail.reviews}
				/>
			</div>
		</div>
	);
}
