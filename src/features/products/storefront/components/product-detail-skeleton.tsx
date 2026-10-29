"use client";

// Client component by necessity: it uses nested antd accesses
// (`Skeleton.Node`, `Skeleton.Button`, `Skeleton.Input`) which resolve to
// `undefined` when imported from a Server Component (antd's "use client"
// banner only covers top-level named imports). This matches the listing's
// `loading.tsx`, which likewise renders the client `LoadingState`.
// The parent `loading.tsx` stays a Server Component that streams this.

import { Skeleton } from "antd";

import styles from "./product-detail-skeleton.module.css";

const SPEC_CARDS = [0, 1, 2, 3, 4, 5, 6, 7];
const THUMBS = [0, 1, 2, 3];
const VARIANT_CARDS = [0, 1];
const REVIEW_CARDS = [0, 1];

/**
 * Loading placeholder that mirrors the redesigned detail layout (breadcrumbs
 * → gallery + info column → tab bar → specs → care guide → reviews), so the
 * 2.3–3.5 s aggregate fetch does not cause the page to jump when the real
 * content arrives (backend defect N4).
 *
 * Announced politely to assistive tech rather than left as silent chrome.
 */
export function ProductDetailSkeleton() {
	return (
		<div className={styles.root} role="status" aria-busy="true">
			<span className={styles.srOnly}>Loading product details</span>

			<div>
				<Skeleton.Input active block style={{ width: 280 }} />
			</div>

			<div className={styles.hero}>
				<div className={styles.gallery}>
					<Skeleton.Node active className={styles.mainImage} />
					<div className={styles.thumbs}>
						{THUMBS.map((index) => (
							<Skeleton.Node
								key={index}
								active
								className={styles.thumb}
							/>
						))}
					</div>
				</div>

				<div className={styles.info}>
					<Skeleton.Input
						active
						block
						style={{ height: 48, width: "70%" }}
					/>
					<Skeleton.Input active block style={{ width: 220 }} />
					<Skeleton
						active
						title={false}
						paragraph={{ rows: 3, width: "100%" }}
					/>
					<div className={styles.variantCards}>
						{VARIANT_CARDS.map((index) => (
							<Skeleton.Node
								key={index}
								active
								className={styles.variantCard}
							/>
						))}
					</div>
					<Skeleton.Input
						active
						block
						style={{ height: 40, width: 180 }}
					/>
					<Skeleton.Input active block style={{ height: 48 }} />
					<Skeleton.Input
						active
						block
						style={{ height: 16, width: "80%" }}
					/>
				</div>
			</div>

			<div className={styles.tabBar}>
				<Skeleton.Input active style={{ width: 360 }} />
			</div>

			<div className={styles.specs}>
				{SPEC_CARDS.map((index) => (
					<Skeleton.Node
						key={index}
						active
						className={styles.specCard}
					/>
				))}
			</div>

			<div className={styles.block}>
				<Skeleton active title={{ width: "35%" }} paragraph={{ rows: 4 }} />
			</div>

			<div className={styles.reviews}>
				<Skeleton.Node active className={styles.summaryCard} />
				<div className={styles.reviewCards}>
					{REVIEW_CARDS.map((index) => (
						<Skeleton.Node
							key={index}
							active
							className={styles.reviewCard}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
