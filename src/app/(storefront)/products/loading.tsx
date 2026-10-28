import { ProductGridSkeleton } from "@/features/products/storefront/components/product-grid-skeleton";

import styles from "./products.module.css";

export default function Loading() {
	return (
		<section className={`page-container ${styles.root}`}>
			<ProductGridSkeleton />
		</section>
	);
}
