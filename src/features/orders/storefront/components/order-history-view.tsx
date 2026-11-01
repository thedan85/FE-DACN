"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
	ArrowLeftOutlined,
	ArrowRightOutlined,
	CalendarOutlined,
	DownOutlined,
	QuestionCircleOutlined,
	SearchOutlined,
} from "@ant-design/icons";
import { Alert, App, Button, Pagination } from "antd";
import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { getAuthErrorMessage } from "@/features/auth/api/auth.api";
import { addToCart } from "@/features/cart/api/cart.api";
import {
	formatDate,
	formatVndPrice,
} from "@/features/products/storefront/model/product-format";
import { useAuthStore } from "@/stores/auth-store";
import type { OrderStatus } from "@/types";

import { listOrders } from "../../api/orders.api";
import type { OrderPage, OrderView } from "../../types";
import { ORDER_STATUS_COPY, paymentLabel } from "../model/order-display";
import { OrderHistorySkeleton } from "./order-history-skeleton";
import styles from "./order-history-view.module.css";

type StatusFilter = "ALL" | OrderStatus;
type DateFilter = "all" | "7" | "30" | "90";

const STATUS_FILTERS: ReadonlyArray<{
	value: StatusFilter;
	label: string;
}> = [
	{ value: "ALL", label: "All Orders" },
	{ value: "PENDING", label: "Pending" },
	{ value: "CONFIRMED", label: "Processing" },
	{ value: "SHIPPING", label: "Shipped" },
	{ value: "COMPLETED", label: "Delivered" },
	{ value: "CANCELLED", label: "Cancelled" },
];

const ORDER_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_ORDER_SEARCH_LENGTH = 100;

type OrdersState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "ready"; page: OrderPage; requestKey: string };

function orderCount(count: number): string {
	return `${count} ${count === 1 ? "order" : "orders"}`;
}

function itemMeta(item: OrderView["items"][number], extraItems: number): string {
	const variant =
		item.attributes.length > 0
			? item.attributes.join(" · ")
			: `SKU ${item.sku}`;
	const extra = extraItems > 0 ? ` · +${extraItems} more` : "";

	return `${variant} ×${item.quantity}${extra}`;
}

function PageFrame({ children }: { children: ReactNode }) {
	return (
		<section className={styles.page}>
			<div className={`page-container ${styles.shell}`}>
				<Link href="/account" className={styles.back}>
					<ArrowLeftOutlined aria-hidden="true" />
					My Account
				</Link>

				<header className={styles.heading}>
					<h1 className={styles.title}>My Orders</h1>
					<p className={styles.subtitle}>
						Track your purchases and order status.
					</p>
				</header>

				{children}
			</div>
		</section>
	);
}

function EmptyOrdersState() {
	return (
		<div className={styles.emptyState}>
			<span className={styles.currents} aria-hidden="true" />

			<div className={styles.aquarium} aria-hidden="true">
				<span className={styles.rim} />
				<span className={styles.tank}>
					<span className={styles.sprout} />
					<span className={styles.fishGroup}>
						<span className={styles.bubbles} />
						<span className={styles.fish} />
					</span>
					<span className={styles.water} />
				</span>
			</div>

			<div className={styles.emptyCopy}>
				<h2 className={styles.emptyTitle}>No orders yet</h2>
				<p className={styles.emptyText}>Your aquarium journey starts here.</p>
			</div>

			<Link href="/products" className={styles.primaryAction}>
				<ArrowRightOutlined aria-hidden="true" />
				Explore Products
			</Link>
		</div>
	);
}

export function OrderHistoryView() {
	const { status, hydrate } = useAuthStore();
	const { message } = App.useApp();
	const [state, setState] = useState<OrdersState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
	const [dateFilter, setDateFilter] = useState<DateFilter>("all");
	const [createdAfter, setCreatedAfter] = useState<string>();
	const [query, setQuery] = useState("");
	const [page, setPage] = useState(0);
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [buyingOrderId, setBuyingOrderId] = useState<string | null>(null);
	const queryTooLong = query.trim().length > MAX_ORDER_SEARCH_LENGTH;
	const requestKey = JSON.stringify([status, page, statusFilter, createdAfter, debouncedQuery, reloadKey]);
	const isFetching = state.status === "loading" ||
		(state.status === "ready" && state.requestKey !== requestKey);

	useEffect(() => {
		void hydrate();
	}, [hydrate]);

	useEffect(() => {
		if (queryTooLong || query.trim() === debouncedQuery) return;
		const timer = window.setTimeout(() => {
			setDebouncedQuery(query.trim());
			setPage(0);
		}, SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [query, debouncedQuery, queryTooLong]);

	useEffect(() => {
		if (status !== "authenticated") {
			return;
		}

		let active = true;

		listOrders({
			page,
			size: ORDER_PAGE_SIZE,
			status: statusFilter === "ALL" ? undefined : statusFilter,
			q: debouncedQuery || undefined,
			createdAfter,
		})
			.then((data) => {
				if (active) {
					const lastPage = Math.max(0, data.totalPages - 1);
					if (page > lastPage) {
						setPage(lastPage);
						return;
					}
					setState({ status: "ready", page: data, requestKey });
				}
			})
			.catch((error: unknown) => {
				if (active) {
					setState({
						status: "error",
						message: getAuthErrorMessage(error),
					});
				}
			});

		return () => {
			active = false;
		};
	}, [status, page, statusFilter, dateFilter, debouncedQuery, createdAfter, reloadKey, requestKey]);

	function changeStatusFilter(value: StatusFilter) {
		setStatusFilter(value);
		setPage(0);
	}

	function changeDateFilter(value: DateFilter) {
		setDateFilter(value);
		setCreatedAfter(value === "all" ? undefined
			: new Date(Date.now() - Number(value) * 24 * 60 * 60 * 1000).toISOString());
		setPage(0);
	}

	function resetFilters() {
		setStatusFilter("ALL");
		setDateFilter("all");
		setCreatedAfter(undefined);
		setQuery("");
		setDebouncedQuery("");
		setPage(0);
	}

	function retry() {
		setState({ status: "loading" });
		setReloadKey((current) => current + 1);
	}

	async function buyAgain(order: OrderView) {
		if (buyingOrderId || order.items.length === 0) {
			return;
		}

		setBuyingOrderId(order.orderId);

		try {
			const results = await Promise.all(
				order.items.map((item) =>
					addToCart({
						variantId: item.variantId,
						quantity: item.quantity,
					}),
				),
			);
			const added = results.filter((result) => result.status === "added").length;
			const total = results.length;

			if (added === total) {
				message.success(
					`Added ${total} ${total === 1 ? "item" : "items"} to your cart.`,
				);
				return;
			}

			if (added === 0) {
				const failure = results.find((result) => result.status === "error");

				message.error(
					failure?.status === "error"
						? failure.message
						: "Please sign in again to add these items to your cart.",
				);
				return;
			}

			message.warning(`Added ${added} of ${total} items to your cart.`);
		} finally {
			setBuyingOrderId(null);
		}
	}

	if (
		status === "loading" ||
		(status === "authenticated" && state.status === "loading")
	) {
		return (
			<PageFrame>
				<OrderHistorySkeleton />
			</PageFrame>
		);
	}

	if (status === "anonymous") {
		return (
			<PageFrame>
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
			</PageFrame>
		);
	}

	if (state.status === "error") {
		return (
			<PageFrame>
				<ErrorState
					className={styles.stateCard}
					title="Could not load your orders"
					description={state.message}
					onRetry={retry}
				/>
			</PageFrame>
		);
	}

	if (state.status === "loading") {
		return (
			<PageFrame>
				<OrderHistorySkeleton />
			</PageFrame>
		);
	}

	const { page: pageData } = state;
	const orders = pageData.content;
	const hasFilters = statusFilter !== "ALL" || dateFilter !== "all" || debouncedQuery !== "" || queryTooLong;

	if (pageData.totalElements === 0 && !hasFilters && !isFetching) {
		return (
			<PageFrame>
				<EmptyOrdersState />
			</PageFrame>
		);
	}

	return (
		<PageFrame>
			<div className={styles.filters}>
				<div
					className={styles.statusFilters}
					role="group"
					aria-label="Filter orders by status"
				>
					{STATUS_FILTERS.map((option) => (
						<button
							key={option.value}
							type="button"
							className={styles.filterPill}
							aria-pressed={statusFilter === option.value}
							onClick={() => changeStatusFilter(option.value)}
						>
							{option.label}
						</button>
					))}
				</div>

				<div className={styles.searchRow}>
					<label className={styles.searchBox}>
						<SearchOutlined className={styles.fieldIcon} aria-hidden="true" />
						<input
							className={styles.searchInput}
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search by order ID"
							aria-label="Search by order ID"
							aria-invalid={queryTooLong}
							aria-describedby={queryTooLong ? "order-search-error" : undefined}
						/>
					</label>

					<label className={styles.dateBox}>
						<CalendarOutlined
							className={styles.fieldIcon}
							aria-hidden="true"
						/>
						<select
							className={styles.dateSelect}
							value={dateFilter}
							onChange={(event) =>
								changeDateFilter(event.target.value as DateFilter)
							}
							aria-label="Filter orders by date"
						>
							<option value="all">All dates</option>
							<option value="7">Last 7 days</option>
							<option value="30">Last 30 days</option>
							<option value="90">Last 90 days</option>
						</select>
						<DownOutlined className={styles.chevron} aria-hidden="true" />
					</label>
				</div>
				{queryTooLong ? (
					<Alert
						id="order-search-error"
						type="error"
						title={`Order ID search must be at most ${MAX_ORDER_SEARCH_LENGTH} characters. Shorten your search to continue.`}
					/>
				) : null}
			</div>

			<div className={styles.ordersCard} aria-busy={isFetching}>
				<div className={styles.listHeading}>
					<p className={styles.count} aria-live="polite">
						{orderCount(pageData.totalElements)}
					</p>
					<p className={styles.sort}>
						<span className={styles.sortPrefix}>Order date · </span>
						Newest first
					</p>
				</div>

				{orders.length === 0 && hasFilters ? (
					<div className={styles.filteredEmpty}>
						<h2 className={styles.emptyTitle}>No orders found</h2>
						<p className={styles.emptyText}>
							Try a different status, order ID, or date range.
						</p>
						<button
							type="button"
							className={styles.clearButton}
							onClick={resetFilters}
						>
							Clear filters
						</button>
					</div>
				) : (
					<>
						<ul className={styles.list}>
							{orders.map((order) => {
								const firstItem = order.items[0];

								return (
									<li key={order.orderId} className={styles.order}>
										<div className={styles.orderRow}>
											<div className={styles.reference}>
												<div className={styles.referenceMain}>
													<p className={styles.orderId}>#{order.orderId}</p>
													<p className={styles.orderDate}>
														{formatDate(order.createdAt) ?? "Date unavailable"}
													</p>
												</div>

												<span
													className={styles.status}
													data-status={order.status}
												>
													<span
														className={styles.statusDot}
														aria-hidden="true"
													/>
													{ORDER_STATUS_COPY[order.status]}
												</span>
											</div>

											<div className={styles.item}>
												<div className={styles.thumb}>
													{firstItem?.thumbnail ? (
														<Image
															src={firstItem.thumbnail}
															alt=""
															fill
															sizes="72px"
															className={styles.thumbImage}
														/>
													) : (
														<MediaPlaceholder label="" />
													)}
												</div>

												<div className={styles.itemInfo}>
													<p className={styles.itemName}>
														{firstItem?.productName ??
															firstItem?.sku ??
															"Product"}
													</p>
													<p className={styles.itemMeta}>
														{firstItem
															? itemMeta(
																	firstItem,
																	order.items.length - 1,
																)
															: "Item details unavailable"}
													</p>
												</div>
											</div>

											<div className={styles.payment}>
												<p className={styles.total}>
													{formatVndPrice(order.total)}
												</p>
												<p className={styles.paymentMeta}>
													{paymentLabel(order.payment)}
												</p>
											</div>

											<div className={styles.actions}>
												<Link
													href={`/account/orders/${order.orderId}`}
													className={styles.detailsButton}
												>
													View Details
												</Link>

												{order.status === "COMPLETED" && (
													<button
														type="button"
														className={styles.secondaryAction}
														onClick={() => void buyAgain(order)}
														disabled={buyingOrderId === order.orderId}
													>
														{buyingOrderId === order.orderId
															? "Adding…"
															: "Buy Again"}
													</button>
												)}
											</div>
										</div>
									</li>
								);
							})}
						</ul>

						{pageData.totalPages > 1 && (
							<div className={styles.pagination}>
								<Pagination
									aria-label="Order pages"
									current={page + 1}
									pageSize={ORDER_PAGE_SIZE}
									total={pageData.totalElements}
									showSizeChanger={false}
									disabled={isFetching}
									onChange={(nextPage) => setPage(nextPage - 1)}
								/>
							</div>
						)}
					</>
				)}
			</div>

			<div className={styles.support}>
				<QuestionCircleOutlined
					className={styles.supportIcon}
					aria-hidden="true"
				/>
				<p className={styles.supportText}>
					Need a hand with an order?{" "}
					<Link href="/contact">Contact Support</Link>
				</p>
			</div>
		</PageFrame>
	);
}
