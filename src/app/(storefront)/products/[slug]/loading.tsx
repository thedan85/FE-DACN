import { ProductDetailSkeleton } from "@/features/products/storefront/components/product-detail-skeleton";

import styles from "./product-detail.module.css";

export default function Loading() {
	return (
		<div className={styles.page}>
			<div className={`page-container ${styles.root}`}>
				<ProductDetailSkeleton />
			</div>
		</div>
	);
}
