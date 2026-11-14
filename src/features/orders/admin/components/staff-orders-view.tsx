"use client";

import { useEffect, useState } from "react";
import { App, Button, Input, Popconfirm, Select, Table, Typography } from "antd";
import type { TableColumnsType } from "antd";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { ApiError } from "@/lib/api/client";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants/labels";
import { getAuthErrorMessage } from "@/features/auth/api/auth.api";
import {
	formatDate,
	formatVndPrice,
	STORE_TIME_ZONE,
} from "@/features/products/storefront/model/product-format";
import { paymentMethodLabel } from "@/features/orders/storefront/model/order-display";
import type { OrderStatus } from "@/types";

import {
	confirmStaffPayment,
	listStaffOrders,
} from "../api/staff-orders.api";
import { ORDER_PERMISSIONS } from "../model/order-permissions";
import { useOrderPermissions } from "../use-order-permissions";
import type { Order, OrderPage } from "../../types";
import styles from "./staff-orders-view.module.css";

const { Title, Text } = Typography;

const PAGE_SIZE = 20;

type StatusFilter = "ALL" | OrderStatus;

type StaffOrdersState =
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string; retryable: boolean }
	| { status: "ready"; page: OrderPage };

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
	{ value: "ALL", label: "All statuses" },
	...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
		value: value as OrderStatus,
		label,
	})),
];

/**
 * Staff order queue.
 *
 * Local state only — the queue is an operational worklist, not a shareable
 * view, so nothing lives in the URL. Fetching follows the order-history
 * pattern: an `active` flag drops stale responses, and a refreshed page that
 * lands past the end steps back to the new last page and refetches instead of
 * showing an empty table for a page that no longer exists.
 */
export function StaffOrdersView() {
	// The hook form, because static `message.*` cannot see the app's theme.
	const { message } = App.useApp();
	const { can } = useOrderPermissions();

	const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
	const [query, setQuery] = useState("");
	const [page, setPage] = useState(0);
	const [reloadKey, setReloadKey] = useState(0);
	const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
	const [state, setState] = useState<StaffOrdersState>({ status: "loading" });

	useEffect(() => {
		let active = true;
		// Deferred so the effect body itself stays free of synchronous state
		// writes; the fetch below already owns the `loading` flag.
		queueMicrotask(() => {
			if (active) {
				setState({ status: "loading" });
			}
		});

		listStaffOrders({
			page,
			size: PAGE_SIZE,
			status: statusFilter === "ALL" ? undefined : statusFilter,
			q: query || undefined,
		})
			.then((data) => {
				if (!active) {
					return;
				}
				const lastPage = Math.max(0, data.totalPages - 1);
				if (page > lastPage) {
					setPage(lastPage);
					return;
				}
				setState({ status: "ready", page: data });
			})
			.catch((caught: unknown) => {
				if (!active) {
					return;
				}

				if (caught instanceof ApiError && caught.status === 403) {
					setState({ status: "forbidden" });
					return;
				}

				// Only a missing connection (0) and server failures (5xx) are worth
				// retrying; a 4xx will fail the same way again.
				const retryable =
					caught instanceof ApiError
						? caught.status === 0 || caught.status >= 500
						: true;

				setState({ status: "error", message: getAuthErrorMessage(caught), retryable });
			});

		return () => {
			active = false;
		};
	}, [statusFilter, query, page, reloadKey]);

	function changeStatusFilter(value: StatusFilter) {
		setStatusFilter(value);
		setPage(0);
	}

	function submitSearch(value: string) {
		setQuery(value.trim());
		setPage(0);
	}

	function clearSearchIfEmpty(value: string) {
		if (value === "") {
			setQuery("");
			setPage(0);
		}
	}

	async function confirmPayment(order: Order) {
		if (confirmingOrderId !== null) {
			return;
		}

		setConfirmingOrderId(order.orderId);

		try {
			const result = await confirmStaffPayment(order.orderId);
			// A FAILED payment is staff cancellation surfacing here: the backend
			// answers REFUND_REQUIRED, and the order was never accepted. The copy
			// must not claim otherwise.
			if (result.status === "REFUND_REQUIRED") {
				message.warning(
					"The order was cancelled before settlement. Refund the payment manually.",
				);
			} else {
				message.success("Payment confirmed; order moved to Confirmed.");
			}
			setReloadKey((key) => key + 1);
		} catch (error) {
			if (error instanceof ApiError && error.status === 403) {
				message.error("You do not have permission to confirm payments.");
			} else {
				message.error(getAuthErrorMessage(error));
			}
		} finally {
			setConfirmingOrderId(null);
		}
	}

	const columns: TableColumnsType<Order> = [
		{
			title: "Order",
			dataIndex: "orderId",
			key: "orderId",
			render: (orderId: string) => <span>#{orderId}</span>,
		},
		{
			title: "Customer",
			dataIndex: "customerName",
			key: "customer",
		},
		{
			title: "Status",
			key: "status",
			render: (_, order) => ORDER_STATUS_LABELS[order.status],
		},
		{
			title: "Total",
			key: "total",
			align: "right",
			render: (_, order) => formatVndPrice(order.total),
		},
		{
			title: "Payment method",
			key: "paymentMethod",
			render: (_, order) =>
				order.payment ? paymentMethodLabel(order.payment.method) : "—",
		},
		{
			title: "Payment status",
			key: "paymentStatus",
			render: (_, order) =>
				order.payment ? PAYMENT_STATUS_LABELS[order.payment.status] : "—",
		},
		{
			title: "Created",
			key: "created",
			render: (_, order) =>
				formatDate(order.createdAt, STORE_TIME_ZONE) ?? "—",
		},
		{
			title: "Action",
			key: "action",
			width: 130,
			render: (_, order) => {
				const payment = order.payment;
				const mayConfirm =
					can(ORDER_PERMISSIONS.update) &&
					payment?.method === "VIETQR" &&
					(payment.status === "PENDING" || payment.status === "FAILED");

				if (!mayConfirm) {
					return null;
				}

				const busy = confirmingOrderId === order.orderId;
				// A FAILED VietQR payment is how a cancelled pending payment looks;
				// confirming it records a refund, it does not accept the order.
				const description =
					payment.status === "FAILED"
						? "This order was cancelled and the payment failed. Confirming records that the payment needs a refund."
						: "Verify the bank transfer first. Confirming also accepts the order.";

				return (
					<Popconfirm
						title="Confirm this VietQR payment?"
						description={description}
						okText="Yes, confirm"
						cancelText="Cancel"
						onConfirm={() => void confirmPayment(order)}
						disabled={busy}
					>
						<Button type="primary" size="small" loading={busy} disabled={busy}>
							Confirm
						</Button>
					</Popconfirm>
				);
			},
		},
	];

	return (
		<section className={styles.page}>
			<header className={styles.header}>
				<div>
					<Title level={1} className={styles.title}>
						Orders
					</Title>
					<Text type="secondary" className={styles.subtitle}>
						Review the queue and confirm VietQR payments after checking the bank transfer.
					</Text>
				</div>
			</header>

			<div className={styles.filters}>
				<Select<StatusFilter>
					aria-label="Filter by status"
					value={statusFilter}
					onChange={changeStatusFilter}
					options={[...STATUS_OPTIONS]}
					style={{ minWidth: 180 }}
				/>

				<Input.Search
					className={styles.search}
					placeholder="Search by order ID"
					maxLength={100}
					allowClear
					onSearch={submitSearch}
					onChange={(event) => clearSearchIfEmpty(event.target.value)}
				/>
			</div>

			{state.status === "forbidden" ? (
				<ErrorState
					title="You do not have access to orders."
					description="Ask an administrator for the order:read permission."
				/>
			) : state.status === "error" ? (
				<ErrorState
					title="Could not load orders"
					description={state.message}
					onRetry={state.retryable ? () => setReloadKey((key) => key + 1) : undefined}
				/>
			) : state.status === "loading" ? (
				<LoadingState rows={6} label="Loading orders" />
			) : state.page.content.length === 0 ? (
				<EmptyState
					title={
						statusFilter === "PENDING"
							? "No pending orders"
							: "No orders match these filters."
					}
				/>
			) : (
				<Table<Order>
					className={styles.table}
					rowKey="orderId"
					columns={columns}
					dataSource={state.page.content}
					scroll={{ x: 960 }}
					pagination={{
						current: page + 1,
						total: state.page.totalElements,
						pageSize: PAGE_SIZE,
						showSizeChanger: false,
						onChange: (next) => setPage(next - 1),
					}}
				/>
			)}
		</section>
	);
}
