"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
	CheckCircleOutlined,
	CloseCircleOutlined,
	ReloadOutlined,
	SearchOutlined,
} from "@ant-design/icons";
import {
	Alert,
	App,
	Button,
	Descriptions,
	Divider,
	Drawer,
	Flex,
	Input,
	Select,
	Space,
	Table,
	Tag,
	Typography,
} from "antd";
import type { TableColumnsType } from "antd";

import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { getAuthErrorMessage } from "@/features/auth/api/auth.api";
import {
	formatDate,
	formatVndPrice,
} from "@/features/products/storefront/model/product-format";
import { paymentLabel } from "@/features/orders/storefront/model/order-display";
import { ApiError } from "@/lib/api/client";
import { ORDER_STATUS_LABELS } from "@/lib/constants/labels";
import { useAuthStore } from "@/stores/auth-store";
import type { OrderStatus } from "@/types";

import {
	completeOrder,
	listStaffOrders,
	updateStaffOrderStatus,
} from "../api/admin-orders.api";
import {
	getOrderActions,
	type OrderAction,
} from "../model/order-actions";
import type { Order, OrderPage } from "../../types";
import styles from "./order-management-view.module.css";

const ORDER_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_ORDER_SEARCH_LENGTH = 100;

const STATUS_OPTIONS: Array<{
	value: OrderStatus | "ALL";
	label: string;
}> = [
	{ value: "ALL", label: "All statuses" },
	...(
		Object.entries(ORDER_STATUS_LABELS) as Array<[OrderStatus, string]>
	).map(([value, label]) => ({ value, label })),
];

const STATUS_COLORS: Record<OrderStatus, string> = {
	PENDING: "gold",
	CONFIRMED: "cyan",
	SHIPPING: "blue",
	COMPLETED: "green",
	CANCELLED: "red",
};

type OrdersState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "ready"; page: OrderPage };

type PendingAction = {
	action: OrderAction;
	order: Order;
};

const ACTION_COPY: Record<
	OrderAction,
	{
		title: (order: Order) => string;
		description: string;
		confirmText: string;
		success: string;
	}
> = {
	accept: {
		title: (order) => `Accept order #${order.orderId}?`,
		description:
			"The order moves to confirmed. The customer can no longer cancel it from the storefront.",
		confirmText: "Accept order",
		success: "Order accepted.",
	},
	reject: {
		title: (order) => `Reject order #${order.orderId}?`,
		description:
			"The order is cancelled, its stock is restored, and any pending payment is failed.",
		confirmText: "Reject order",
		success: "Order rejected.",
	},
	complete: {
		title: (order) => `Mark order #${order.orderId} completed?`,
		description:
			"This bypasses the shipping flow. Stock and payment are left unchanged.",
		confirmText: "Mark completed",
		success: "Order marked completed.",
	},
};

function orderCount(count: number): string {
	return `${count} ${count === 1 ? "order" : "orders"}`;
}

function itemSummary(order: Order): string {
	const first = order.items[0];

	if (!first) {
		return "No items";
	}

	const name = first.productName ?? first.sku;
	const extra = order.items.length - 1;

	return `${name} ×${first.quantity}${extra > 0 ? ` · +${extra} more` : ""}`;
}

function replaceOrder(page: OrderPage, updated: Order): OrderPage {
	return {
		...page,
		content: page.content.map((order) =>
			order.orderId === updated.orderId ? updated : order,
		),
	};
}

export function OrderManagementView() {
	const { message } = App.useApp();
	const permissions = useAuthStore((state) => state.user?.permissions);
	const [state, setState] = useState<OrdersState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);
	const [page, setPage] = useState(0);
	const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [detailOrder, setDetailOrder] = useState<Order | null>(null);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (query === debouncedQuery) {
			return;
		}

		const timer = window.setTimeout(() => {
			setDebouncedQuery(query.trim());
			setPage(0);
		}, SEARCH_DEBOUNCE_MS);

		return () => window.clearTimeout(timer);
	}, [query, debouncedQuery]);

	useEffect(() => {
		let active = true;
		setState({ status: "loading" });

		listStaffOrders({
			page,
			size: ORDER_PAGE_SIZE,
			status: statusFilter === "ALL" ? undefined : statusFilter,
			q: debouncedQuery || undefined,
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
	}, [page, statusFilter, debouncedQuery, reloadKey]);

	function retry() {
		setReloadKey((current) => current + 1);
	}

	function requestAction(order: Order, action: OrderAction) {
		setPendingAction({ order, action });
	}

	async function confirmAction() {
		if (pendingAction === null || submitting) {
			return;
		}

		const { action, order } = pendingAction;
		setSubmitting(true);

		try {
			const updated =
				action === "complete"
					? await completeOrder(order.orderId)
					: await updateStaffOrderStatus(
							order.orderId,
							action === "accept" ? "CONFIRMED" : "CANCELLED",
						);

			setDetailOrder((current) =>
				current?.orderId === updated.orderId ? updated : current,
			);
			message.success(ACTION_COPY[action].success);
			setPendingAction(null);

			// The updated order no longer belongs to the active status filter.
			if (statusFilter !== "ALL" && updated.status !== statusFilter) {
				retry();
			} else {
				setState((current) =>
					current.status === "ready"
						? { ...current, page: replaceOrder(current.page, updated) }
						: current,
				);
			}
		} catch (error) {
			message.error(getAuthErrorMessage(error));

			// A 409 means another request changed the order first. Reload so
			// the table shows the backend's current state before the next action.
			if (error instanceof ApiError && error.status === 409) {
				setPendingAction(null);
				retry();
			}
		} finally {
			setSubmitting(false);
		}
	}

	function actionButtons(order: Order, showView = true) {
		const actions = getOrderActions(order.status, permissions);

		return (
			<Space size={4} wrap>
				{showView && (
					<Button size="small" onClick={() => setDetailOrder(order)}>
						View
					</Button>
				)}

				{actions.includes("accept") && (
					<Button
						size="small"
						type="primary"
						aria-label="Accept"
						onClick={() => requestAction(order, "accept")}
					>
						Accept
					</Button>
				)}

				{actions.includes("reject") && (
					<Button
						size="small"
						danger
						aria-label="Reject"
						onClick={() => requestAction(order, "reject")}
					>
						Reject
					</Button>
				)}

				{actions.includes("complete") && (
					<Button
						size="small"
						icon={<CheckCircleOutlined />}
						aria-label="Complete"
						onClick={() => requestAction(order, "complete")}
					>
						Complete
					</Button>
				)}
			</Space>
		);
	}

	const columns: TableColumnsType<Order> = [
		{
			title: "Order",
			key: "order",
			width: 190,
			render: (_, order) => (
				<div className={styles.reference}>
					<span className={styles.orderId}>#{order.orderId}</span>
					<span className={styles.muted}>
						{formatDate(order.createdAt) ?? "Date unavailable"}
					</span>
				</div>
			),
		},
		{
			title: "Customer",
			key: "customer",
			width: 180,
			render: (_, order) => (
				<div className={styles.reference}>
					<span>{order.customerName}</span>
					<span className={styles.muted}>{order.phone}</span>
				</div>
			),
		},
		{
			title: "Items",
			key: "items",
			render: (_, order) => (
				<div className={styles.reference}>
					<span>{itemSummary(order)}</span>
					<span className={styles.muted}>
						{order.items.length} {order.items.length === 1 ? "line" : "lines"}
					</span>
				</div>
			),
		},
		{
			title: "Total",
			key: "total",
			width: 130,
			render: (_, order) => (
				<span className={styles.total}>{formatVndPrice(order.total)}</span>
			),
		},
		{
			title: "Payment",
			key: "payment",
			width: 170,
			render: (_, order) => (
				<span className={styles.muted}>{paymentLabel(order.payment)}</span>
			),
		},
		{
			title: "Status",
			key: "status",
			width: 120,
			render: (_, order) => (
				<Tag color={STATUS_COLORS[order.status]}>
					{ORDER_STATUS_LABELS[order.status]}
				</Tag>
			),
		},
		{
			title: "Actions",
			key: "actions",
			width: 360,
			render: (_, order) => actionButtons(order),
		},
	];

	const pageData = state.status === "ready" ? state.page : null;

	return (
		<section className={styles.page}>
			<header className={styles.heading}>
				<div>
					<Typography.Title className={styles.title} level={1}>
						Orders
					</Typography.Title>
					<Typography.Paragraph className={styles.subtitle}>
						Review, accept, reject, and complete customer orders.
					</Typography.Paragraph>
				</div>

				<Button
					icon={<ReloadOutlined />}
					onClick={retry}
					aria-label="Refresh orders"
				>
					Refresh
				</Button>
			</header>

			<Flex className={styles.toolbar} gap={12} wrap>
				<Input
					className={styles.search}
					prefix={<SearchOutlined />}
					placeholder="Search ID, customer, phone"
					aria-label="Search orders"
					type="search"
					allowClear
					maxLength={MAX_ORDER_SEARCH_LENGTH}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>

				<Select<OrderStatus | "ALL">
					className={styles.statusFilter}
					aria-label="Filter orders by status"
					value={statusFilter}
					options={STATUS_OPTIONS}
					onChange={(value) => {
						setStatusFilter(value);
						setPage(0);
					}}
				/>

				<span className={styles.count} aria-live="polite">
					{pageData ? orderCount(pageData.totalElements) : "Loading orders…"}
				</span>
			</Flex>

			{state.status === "error" ? (
				<ErrorState
					className={styles.stateCard}
					title="Could not load orders"
					description={state.message}
					onRetry={retry}
				/>
			) : (
				<Table<Order>
					className={styles.table}
					columns={columns}
					dataSource={pageData?.content ?? []}
					rowKey="orderId"
					loading={state.status === "loading"}
					scroll={{ x: 1200 }}
					pagination={{
						current: page + 1,
						pageSize: ORDER_PAGE_SIZE,
						total: pageData?.totalElements ?? 0,
						showSizeChanger: false,
						disabled: state.status === "loading",
						onChange: (nextPage) => setPage(nextPage - 1),
					}}
					locale={{
						emptyText: state.status === "loading" ? " " : "No orders found.",
					}}
				/>
			)}

			<Drawer
				title={
					detailOrder ? `Order #${detailOrder.orderId}` : "Order details"
				}
				open={detailOrder !== null}
				size={560}
				onClose={() => setDetailOrder(null)}
				footer={
					detailOrder ? (
						<div className={styles.drawerFooter}>
							{actionButtons(detailOrder, false)}
						</div>
					) : null
				}
			>
				{detailOrder && <OrderDetails order={detailOrder} />}
			</Drawer>

			<ConfirmDialog
				open={pendingAction !== null}
				title={
					pendingAction
						? ACTION_COPY[pendingAction.action].title(pendingAction.order)
						: ""
				}
				description={
					pendingAction
						? ACTION_COPY[pendingAction.action].description
						: undefined
				}
				confirmText={
					pendingAction
						? ACTION_COPY[pendingAction.action].confirmText
						: undefined
				}
				cancelText="Cancel"
				confirmLoading={submitting}
				onConfirm={() => void confirmAction()}
				onCancel={() => {
					if (!submitting) {
						setPendingAction(null);
					}
				}}
			/>
		</section>
	);
}

function OrderDetails({ order }: { order: Order }) {
	return (
		<div className={styles.drawerBody}>
			<Flex align="center" gap={10} wrap>
				<Tag color={STATUS_COLORS[order.status]}>
					{ORDER_STATUS_LABELS[order.status]}
				</Tag>
				<Typography.Text type="secondary">
					Placed {formatDate(order.createdAt) ?? "date unavailable"}
				</Typography.Text>
			</Flex>

			<Descriptions column={1} size="small" bordered>
				<Descriptions.Item label="Customer">
					{order.customerName}
				</Descriptions.Item>
				<Descriptions.Item label="Recipient">
					{order.recipientName}
				</Descriptions.Item>
				<Descriptions.Item label="Phone">{order.phone}</Descriptions.Item>
				<Descriptions.Item label="Shipping address">
					{order.address}
				</Descriptions.Item>
				<Descriptions.Item label="Payment">
					{paymentLabel(order.payment)}
				</Descriptions.Item>
				<Descriptions.Item label="Total">
					<strong>{formatVndPrice(order.total)}</strong>
				</Descriptions.Item>
			</Descriptions>

			<Divider className={styles.divider}>Items</Divider>

			{order.items.length === 0 ? (
				<Alert
					type="warning"
					showIcon
					title="This order has no item lines."
				/>
			) : (
				<ul className={styles.items}>
					{order.items.map((item, index) => (
						<li key={`${item.variantId}-${index}`} className={styles.item}>
							<div className={styles.thumb}>
								{item.thumbnail ? (
									<Image
										src={item.thumbnail}
										alt=""
										fill
										sizes="56px"
										className={styles.thumbImage}
									/>
								) : (
									<MediaPlaceholder label="" />
								)}
							</div>

							<div className={styles.itemInfo}>
								<span className={styles.itemName}>
									{item.productName ?? item.sku}
								</span>
								<span className={styles.muted}>
									{item.attributes.length > 0
										? item.attributes.join(" · ")
										: `SKU ${item.sku}`}{" "}
									×{item.quantity}
								</span>
							</div>

							<span className={styles.itemTotal}>
								{formatVndPrice(item.unitPrice * item.quantity)}
							</span>
						</li>
					))}
				</ul>
			)}

			{order.status === "PENDING" && (
				<p className={styles.hint}>
					<CloseCircleOutlined aria-hidden="true" /> Rejecting restores stock
					and fails any pending payment.
				</p>
			)}
		</div>
	);
}
