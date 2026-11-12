"use client";

import Image from "next/image";
import Link from "next/link";
import { Empty } from "antd";

import type { DashboardSummary } from "../types";
import styles from "./dashboard-view.module.css";

type LowStockAlertsProps = {
	products: DashboardSummary["lowStockProducts"];
	lowStock: DashboardSummary["lowStock"];
};

/**
 * Active products at or below the backend's total-variant threshold, lowest
 * stock first. The backend caps the list at five; the count is the full total,
 * so the footnote can point at the rest without another request.
 */
export function LowStockAlerts({ products, lowStock }: LowStockAlertsProps) {
	return (
		<section
			className={`${styles.panel} ${styles.lowStockPanel}`}
			aria-labelledby="low-stock-title"
		>
			<div className={styles.panelHeader}>
				<div className={styles.lowStockHeading}>
					<Image
						src="/images/admin/dashboard/triangle-alert.svg"
						alt=""
						width={17}
						height={17}
						unoptimized
					/>
					<h2 id="low-stock-title" className={styles.panelTitle}>
						Low stock alerts
					</h2>
					<span className={styles.lowStockCount}>{lowStock.count}</span>
				</div>
			</div>

			{products.length === 0 ? (
				<Empty
					image={Empty.PRESENTED_IMAGE_SIMPLE}
					description={`No active product is at or below ${lowStock.threshold} units.`}
				/>
			) : (
				<ul className={styles.lowStockList}>
					{products.map((product) => (
						<li key={product.productId} className={styles.lowStockItem}>
							{product.thumbnail ? (
								<Image
									className={styles.lowStockThumb}
									src={product.thumbnail}
									alt=""
									width={48}
									height={48}
									unoptimized
								/>
							) : (
								<span className={styles.lowStockThumbFallback} aria-hidden="true">
									<Image
										src="/images/admin/dashboard/fish.svg"
										alt=""
										width={22}
										height={22}
										unoptimized
									/>
								</span>
							)}

							<div className={styles.lowStockInfo}>
								<div className={styles.lowStockNameRow}>
									<span className={styles.lowStockName}>{product.name}</span>
									<span className={styles.lowStockUnits}>
										{product.stock} left
									</span>
								</div>
								<Link
									className={styles.lowStockLink}
									href={`/admin/products/${product.slug}/edit`}
								>
									Manage stock →
								</Link>
							</div>
						</li>
					))}
				</ul>
			)}

			<p className={styles.lowStockFootnote}>
				Showing {products.length} of {lowStock.count} active items at or below{" "}
				{lowStock.threshold} units.
			</p>
		</section>
	);
}
