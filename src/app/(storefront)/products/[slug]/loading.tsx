import { ProductDetailSkeleton } from "@/features/products/storefront/components/product-detail-skeleton";

import styles from "./product-detail.module.css";

export default function Loading() {
	return (
		<section className={`page-container ${styles.root}`}>
			<ProductDetailSkeleton />
		</section>
	);
}
