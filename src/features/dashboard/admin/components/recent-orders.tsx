"use client";

import { Empty, Table } from "antd";
import type { TableColumnsType } from "antd";

import { PAYMENT_STATUS_COPY } from "@/features/orders/storefront/model/order-display";
import type { OrderPage, OrderView } from "@/features/orders/types";
import {
	formatDate,
	formatVndPrice,
	STORE_TIME_ZONE,
} from "@/features/products/storefront/model/product-format";

import { DASHBOARD_ORDER_STATUS_LABELS } from "../model/order-status";
import styles from "./dashboard-view.module.css";

type RecentOrdersProps = {
	orders: OrderPage;
};

/**
 * The newest orders, read-only. There is no admin order-detail route yet, so
 * the design's eye/ellipsis actions are intentionally absent rather than
 * buttons that lead nowhere. Payment comes from the order's payment record;
 * orders without one show an em dash.
 */
export function RecentOrders({ orders }: RecentOrdersProps) {
	const columns: TableColumnsType<OrderView> = [
		{
			title: "Order ID",
			dataIndex: "orderId",
			key: "orderId",
			width: 130,
			render: (orderId: string) => (
				<span className={styles.orderId}>{orderId}</span>
			),
		},
		{
			title: "Customer",
			dataIndex: "customerName",
			key: "customer",
			width: 230,
			render: (name: string) => <span className={styles.orderCustomer}>{name}</span>,
		},
		{
			title: "Date",
			dataIndex: "createdAt",
			key: "date",
			width: 150,
			render: (createdAt: string) => (
				<span className={styles.orderMuted}>
					{formatDate(createdAt, STORE_TIME_ZONE) ?? "—"}
				</span>
			),
		},
		{
			title: "Total",
			dataIndex: "total",
			key: "total",
			width: 140,
			align: "right",
			render: (total: number) => (
				<span className={styles.orderTotal}>{formatVndPrice(total)}</span>
			),
		},
		{
			title: "Payment",
			key: "payment",
			width: 140,
			render: (_, order) => (
				<span className={styles.orderMuted}>
					{order.payment ? PAYMENT_STATUS_COPY[order.payment.status] : "—"}
				</span>
			),
		},
		{
			title: "Status",
			dataIndex: "status",
			key: "status",
			width: 150,
			render: (_, order) => (
				<span className={styles.statusBadge} data-status={order.status}>
					<span className={styles.statusDot} aria-hidden="true" />
					{DASHBOARD_ORDER_STATUS_LABELS[order.status]}
				</span>
			),
		},
	];

	return (
		<section
			className={`${styles.panel} ${styles.ordersPanel}`}
			aria-labelledby="recent-orders-title"
		>
			<div className={styles.panelHeader}>
				<div className={styles.panelTitleBlock}>
					<h2 id="recent-orders-title" className={styles.panelTitle}>
						Recent orders
					</h2>
					<p className={styles.panelSubtitle}>
						{orders.totalElements} total orders
					</p>
				</div>
			</div>

			<Table<OrderView>
				className={styles.ordersTable}
				columns={columns}
				dataSource={orders.content}
				rowKey="orderId"
				pagination={false}
				scroll={{ x: 940 }}
				locale={{
					emptyText: (
						<Empty
							image={Empty.PRESENTED_IMAGE_SIMPLE}
							description="No orders yet."
						/>
					),
				}}
			/>

			<p className={styles.ordersFootnote}>
				Showing the {orders.content.length} most recent of {orders.totalElements}{" "}
				orders.
			</p>
		</section>
	);
}
