import Link from "next/link";
import { Result } from "antd";

import styles from "./product-detail.module.css";

/**
 * Rendered for an unknown slug, a malformed slug and a product that is not
 * publicly visible — to an anonymous caller those three are the same 404
 * (the backend does not distinguish them, by design).
 */
export default function ProductNotFound() {
	return (
		<section className={`page-container ${styles.root}`}>
			<Result
				status="404"
				title="Product not found"
				subTitle="This product does not exist, is no longer available, or the link is incorrect."
				extra={
					<Link className={styles.notFoundLink} href="/products">
						Back to products
					</Link>
				}
			/>
		</section>
	);
}
