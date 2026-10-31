"use client";

import { Skeleton } from "antd";

import styles from "./order-history-skeleton.module.css";

const FILTER_PILLS = [0, 1, 2, 3, 4, 5];
const ORDER_ROWS = [0, 1, 2, 3];

/**
 * Loading placeholder that mirrors the order-history layout (status pills,
 * search row, order card rows) so the page does not jump when orders arrive.
 *
 * Announced politely to assistive tech rather than left as silent chrome.
 */
export function OrderHistorySkeleton() {
	return (
		<div className={styles.root} role="status" aria-busy="true">
			<span className={styles.srOnly}>Loading order history</span>

			<div className={styles.filters}>
				<div className={styles.statusFilters}>
					{FILTER_PILLS.map((index) => (
						<Skeleton.Button
							key={index}
							active
							size="small"
							className={styles.pill}
						/>
					))}
				</div>

				<div className={styles.searchRow}>
					<Skeleton.Input active className={styles.searchBox} />
					<Skeleton.Input active className={styles.dateBox} />
				</div>
			</div>

			<div className={styles.ordersCard}>
				<div className={styles.listHeading}>
					<Skeleton.Input active size="small" style={{ width: 72 }} />
					<Skeleton.Input active size="small" style={{ width: 148 }} />
				</div>

				<ul className={styles.list}>
					{ORDER_ROWS.map((index) => (
						<li key={index} className={styles.order}>
							<div className={styles.orderRow}>
								<div className={styles.reference}>
									<div className={styles.referenceMain}>
										<Skeleton.Input
											active
											size="small"
											style={{ width: "82%" }}
										/>
										<Skeleton.Input
											active
											size="small"
											style={{ width: "58%" }}
										/>
									</div>
									<Skeleton.Button
										active
										size="small"
										className={styles.status}
									/>
								</div>

								<div className={styles.item}>
									<Skeleton.Node active className={styles.thumb} />
									<div className={styles.itemInfo}>
										<Skeleton.Input
											active
											size="small"
											style={{ width: "70%" }}
										/>
										<Skeleton.Input
											active
											size="small"
											style={{ width: "48%" }}
										/>
									</div>
								</div>

								<div className={styles.payment}>
									<Skeleton.Input
										active
										size="small"
										style={{ width: 92 }}
									/>
									<Skeleton.Input
										active
										size="small"
										style={{ width: 108 }}
									/>
								</div>

								<div className={styles.actions}>
									<Skeleton.Button
										active
										className={styles.detailsButton}
									/>
								</div>
							</div>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
