"use client";

import { Skeleton } from "antd";

import styles from "./catalog-states.module.css";

/**
 * The listing's loading state: a header-sized bar plus three row silhouettes,
 * matching the shape of the table so the page does not jump when it resolves.
 *
 * `Skeleton` is `display: table` at its root, so the rows are laid out with
 * flex here rather than relying on its own paragraph gaps (`docs/antd.md`).
 */
export function CatalogListSkeleton() {
	return (
		<div className={styles.skeleton} aria-busy="true" aria-live="polite">
			<span className={styles.srOnly}>Loading products…</span>
			<div className={styles.skeletonRows}>
				{Array.from({ length: 3 }, (_, index) => (
					<div className={styles.skeletonRow} key={index} aria-hidden="true">
						<Skeleton.Avatar active shape="square" size={44} />
						<Skeleton.Input active block style={{ height: 12 }} />
						<Skeleton.Input active style={{ width: 84, height: 12 }} />
					</div>
				))}
			</div>
		</div>
	);
}
