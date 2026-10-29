"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button, Pagination, Tag } from "antd";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAuthErrorMessage } from "@/features/auth/api";
import {
	formatDate,
	formatVndPrice,
} from "@/features/products/storefront/model/product-format";
import { ORDER_STATUS_LABELS } from "@/lib/constants/labels";
import { useAuthStore } from "@/stores/auth-store";
import type { OrderStatus } from "@/types";

import { listOrders } from "../api";
import type { OrderPage } from "../api";
import styles from "./order-history-view.module.css";

const PAGE_SIZE = 10;

const STATUS_COLORS: Record<OrderStatus, string> = {
	PENDING: "gold",
	CONFIRMED: "blue",
	SHIPPING: "cyan",
	COMPLETED: "green",
	CANCELLED: "red",
};

type OrdersState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "ready"; data: OrderPage };

function OrderFrame({ children }: { children: ReactNode }) {
	return (
		<section className={styles.page}>
			<div className="page-container">
				<header className={styles.intro}>
					<div>
						<h1>Order History</h1>
						<p>Review the orders you have placed with us.</p>
					</div>
					<Button href="/account">Back to Account</Button>
				</header>

				{children}
			</div>
		</section>
	);
}

export function OrderHistoryView() {
	const { status, hydrate } = useAuthStore();
	const [state, setState] = useState<OrdersState>({ status: "loading" });
	const [page, setPage] = useState(0);
	const [reloadKey, setReloadKey] = useState(0);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void hydrate();
	}, [hydrate]);

	useEffect(() => {
		if (status !== "authenticated") {
			return;
		}

		let active = true;

		listOrders(page, PAGE_SIZE)
			.then((data) => {
				if (active) {
					setState({ status: "ready", data });
				}
			})
			.catch((error: unknown) => {
				if (active) {
					setState({
						status: "error",
						message: getAuthErrorMessage(error),
					});
				}
			})
			.finally(() => {
				if (active) {
					setBusy(false);
				}
			});

		return () => {
			active = false;
		};
	}, [status, page, reloadKey]);

	function changePage(nextPage: number) {
		if (busy || nextPage === page) {
			return;
		}

		setBusy(true);
		setPage(nextPage);
	}

	function retry() {
		setState({ status: "loading" });
		setBusy(true);
		setReloadKey((current) => current + 1);
	}

	if (status === "loading" || (status === "authenticated" && state.status === "loading")) {
		return (
			<OrderFrame>
				<LoadingState
					className={styles.stateCard}
					rows={6}
					label="Loading order history"
				/>
			</OrderFrame>
		);
	}

	if (status === "anonymous") {
		return (
			<OrderFrame>
				<EmptyState
					className={styles.stateCard}
					title="Sign in to view your orders"
					description="Order history is tied to your account."
					action={
						<Button type="primary" href="/login">
							Log In
						</Button>
					}
				/>
			</OrderFrame>
		);
	}

	if (state.status === "error") {
		return (
			<OrderFrame>
				<ErrorState
					className={styles.stateCard}
					title="Could not load your orders"
					description={state.message}
					onRetry={retry}
				/>
			</OrderFrame>
		);
	}

	if (state.status === "loading") {
		return (
			<OrderFrame>
				<LoadingState
					className={styles.stateCard}
					rows={6}
					label="Loading order history"
				/>
			</OrderFrame>
		);
	}

	const { data } = state;

	if (data.content.length === 0) {
		return (
			<OrderFrame>
				<EmptyState
					className={styles.stateCard}
					title="No orders yet"
					description="Orders you place will appear here."
					action={
						<Button type="primary" href="/products">
							Browse Products
						</Button>
					}
				/>
			</OrderFrame>
		);
	}

	return (
		<OrderFrame>
			<div className={styles.list} aria-busy={busy || undefined}>
				{data.content.map((order) => (
					<article key={order.orderId} className={styles.orderCard}>
						<header className={styles.orderHeader}>
							<div>
								<h2>Order {order.orderId}</h2>
								<p>{formatDate(order.createdAt) ?? "Date unavailable"}</p>
							</div>
							<Tag color={STATUS_COLORS[order.status]}>
								{ORDER_STATUS_LABELS[order.status]}
							</Tag>
						</header>

						<ul className={styles.items}>
							{order.items.map((item) => (
								<li
									key={`${item.orderId}-${item.variantId}`}
									className={styles.item}
								>
									<div className={styles.itemInfo}>
										<strong>
											{item.productName ?? item.sku}
										</strong>
										<span>SKU: {item.sku}</span>
									</div>
									<span className={styles.itemMeta}>
										{item.quantity} × {formatVndPrice(item.unitPrice)}
									</span>
									<span className={styles.itemTotal}>
										{formatVndPrice(item.quantity * item.unitPrice)}
									</span>
								</li>
							))}
						</ul>

						<div className={styles.orderMeta}>
							<p>
								Deliver to <strong>{order.recipientName}</strong> ·{" "}
								{order.phone}
							</p>
							<p>{order.address}</p>
						</div>

						<footer className={styles.orderFooter}>
							<span className={styles.totalLabel}>Order total</span>
							<strong className={styles.total}>
								{formatVndPrice(order.total)}
							</strong>
						</footer>
					</article>
				))}
			</div>

			{data.totalPages > 1 && (
				<div className={styles.pagination}>
					<Pagination
						current={data.page + 1}
						pageSize={data.size}
						total={data.totalElements}
						showSizeChanger={false}
						disabled={busy}
						onChange={(nextPage) => changePage(nextPage - 1)}
					/>
				</div>
			)}
		</OrderFrame>
	);
}
