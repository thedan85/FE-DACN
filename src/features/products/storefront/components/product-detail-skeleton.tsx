"use client";

// Client component by necessity: it uses nested antd accesses
// (`Skeleton.Node`, `Skeleton.Button`, `Skeleton.Input`) which resolve to
// `undefined` when imported from a Server Component (antd's "use client"
// banner only covers top-level named imports). This matches the listing's
// `loading.tsx`, which likewise renders the client `LoadingState`.
// The parent `loading.tsx` stays a Server Component that streams this.

import { Card, Skeleton } from "antd";

import styles from "./product-detail-skeleton.module.css";

/**
 * Loading placeholder that mirrors the final detail layout (back button →
 * information card → variant selector + detail → description → reviews), so
 * the 2.3–3.5 s aggregate fetch does not cause the page to jump when the
 * real content arrives (backend defect N4).
 *
 * Announced politely to assistive tech rather than left as silent chrome.
 */
export function ProductDetailSkeleton() {
	return (
		<div className={styles.root} role="status" aria-busy="true">
			<span className={styles.srOnly}>Loading product details</span>

			<div className={styles.toolbar}>
				<Skeleton.Button active size="small" />
			</div>

			<div className={styles.card}>
				<Skeleton active title={{ width: "40%" }} paragraph={{ rows: 5 }} />
			</div>

			<div className={styles.card}>
				<Skeleton.Button active size="small" style={{ width: 180 }} />
				<div className={styles.slides}>
					{[0, 1, 2].map((index) => (
						<div key={index} className={styles.slide}>
							<Skeleton.Node active className={styles.node} />
							<Skeleton.Input active size="small" block />
							<Skeleton.Input active size="small" block />
						</div>
					))}
				</div>
			</div>

			<div className={styles.detailGrid}>
				<div className={styles.imageBox}>
					<Skeleton.Node active className={styles.node} />
				</div>

				<div className={styles.detailColumn}>
					<Card>
						<Skeleton
							active
							title={{ width: "45%" }}
							paragraph={{ rows: 3 }}
						/>
					</Card>

					<Card>
						<Skeleton active title={false} paragraph={{ rows: 2 }} />
					</Card>
				</div>
			</div>

			<div className={styles.card}>
				<Skeleton active title={{ width: "35%" }} paragraph={{ rows: 6 }} />
			</div>

			<div className={styles.card}>
				<Skeleton active title={{ width: "30%" }} paragraph={{ rows: 5 }} />
			</div>
		</div>
	);
}
