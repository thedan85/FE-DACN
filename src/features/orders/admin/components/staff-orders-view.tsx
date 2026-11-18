"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
	CheckCircleOutlined,
	CloseCircleOutlined,
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
	Popconfirm,
	Select,
	Space,
	Table,
	Tag,
	Typography,
} from "antd";
import type { TableColumnsType } from "antd";

import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { ApiError } from "@/lib/api/client";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants/labels";
import { getAuthErrorMessage } from "@/features/auth/api/auth.api";
import {
	formatDate,
	formatVndPrice,
	STORE_TIME_ZONE,
} from "@/features/products/storefront/model/product-format";
import {
	paymentLabel,
	paymentMethodLabel,
} from "@/features/orders/storefront/model/order-display";
import type { OrderStatus } from "@/types";

import {
	completeOrder,
	confirmStaffPayment,
	listStaffOrders,
	updateStaffOrderStatus,
} from "../api/staff-orders.api";
import { ORDER_PERMISSIONS } from "../model/order-permissions";
import { getOrderActions, type OrderAction } from "../model/order-actions";
import { useOrderPermissions } from "../use-order-permissions";
import type { Order, OrderPage } from "../../types";
import { ShipOrderModal } from "./ship-order-modal";
import styles from "./staff-orders-view.module.css";

const { Title, Text } = Typography;

const PAGE_SIZE = 20;

type StatusFilter = "ALL" | OrderStatus;

type StaffOrdersState =
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string; retryable: boolean }
	| { status: "ready"; page: OrderPage };

type PendingAction = {
	action: OrderAction;
	order: Order;
};

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
	{ value: "ALL", label: "All statuses" },
	...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
		value: value as OrderStatus,
		label,
	})),
];

const STATUS_COLORS: Record<OrderStatus, string> = {
	PENDING: "gold",
	CONFIRMED: "cyan",
	SHIPPING: "blue",
	COMPLETED: "green",
	CANCELLED: "red",
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
			"The order moves to confirmed and the customer can no longer cancel it from the storefront. For VietQR orders, confirming the payment instead also accepts the order.",
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

function replaceOrder(page: OrderPage, updated: Order): OrderPage {
	return {
		...page,
		content: page.content.map((order) =>
			order.orderId === updated.orderId ? updated : order,
		),
	};
}

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
	const { can, permissions } = useOrderPermissions();

	const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
	const [query, setQuery] = useState("");
	const [page, setPage] = useState(0);
	const [reloadKey, setReloadKey] = useState(0);
	const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
	const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
	const [detailOrder, setDetailOrder] = useState<Order | null>(null);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
	const [submitting, setSubmitting] = useState(false);
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
				setReloadKey((key) => key + 1);
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
				setReloadKey((key) => key + 1);
			}
		} finally {
			setSubmitting(false);
		}
	}

	function actionButtons(order: Order, showView = true) {
		const actions = getOrderActions(order.status, permissions);

		return (
			<>
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
			</>
		);
	}

	const columns: TableColumnsType<Order> = [
		{
			title: "Order ID",
			dataIndex: "orderId",
			key: "orderId",
			minWidth: 136,
			render: (orderId: string) => <span className={styles.orderId}>#{orderId}</span>,
		},
		{
			title: "Customer",
			dataIndex: "customerName",
			key: "customer",
			minWidth: 168,
			className: styles.customer,
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
			className: styles.total,
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
			title: "GHN code",
			key: "ghnOrderCode",
			render: (_, order) => order.ghnOrderCode ? <Text code>{order.ghnOrderCode}</Text> : "—",
		},
		{
			title: "Created at",
			key: "created",
			render: (_, order) =>
				formatDate(order.createdAt, STORE_TIME_ZONE) ?? "—",
		},
		{
			title: "Actions",
			key: "action",
			width: 320,
			render: (_, order) => {
				const payment = order.payment;
				const mayShip =
					can(ORDER_PERMISSIONS.update) &&
					order.status === "CONFIRMED" &&
					order.ghnOrderCode === null &&
					payment != null &&
					(payment.method === "COD" || payment.status === "CONFIRMED");

				const mayConfirm =
					can(ORDER_PERMISSIONS.update) &&
					payment?.method === "VIETQR" &&
					(payment.status === "PENDING" || payment.status === "FAILED");

				const busy = confirmingOrderId === order.orderId;

				return (
					<Space size={4} wrap>
						{actionButtons(order)}

						{mayShip ? (
							<Button
								type="primary"
								size="small"
								disabled={confirmingOrderId !== null}
								onClick={() => setShippingOrder(order)}
							>
								Ship with GHN
							</Button>
						) : mayConfirm ? (
							<Popconfirm
								title="Confirm this VietQR payment?"
								description={
									payment.status === "FAILED"
										? "This order was cancelled and the payment failed. Confirming records that the payment needs a refund."
										: "Verify the bank transfer first. Confirming also accepts the order."
								}
								okText="Yes, confirm"
								cancelText="Cancel"
								onConfirm={() => void confirmPayment(order)}
								disabled={busy}
							>
								<Button type="primary" size="small" loading={busy} disabled={busy}>
									Confirm
								</Button>
							</Popconfirm>
						) : null}
					</Space>
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
						Review, accept, reject, and complete customer orders, confirm VietQR payments, and book confirmed orders with GHN.
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
					classNames={{ header: { cell: styles.columnHeading } }}
					rowKey="orderId"
					columns={columns}
					dataSource={state.page.content}
					scroll={{ x: 1360 }}
					pagination={{
						current: page + 1,
						total: state.page.totalElements,
						pageSize: PAGE_SIZE,
						showSizeChanger: false,
						onChange: (next) => setPage(next - 1),
					}}
				/>
			)}
			{shippingOrder && can(ORDER_PERMISSIONS.update) && (
				<ShipOrderModal
					key={shippingOrder.orderId}
					order={shippingOrder}
					onClose={() => setShippingOrder(null)}
					onBooked={(booked) => {
						setShippingOrder(null);
						message.success(`GHN shipment booked: ${booked.ghnOrderCode}. Awaiting pickup.`);
						setReloadKey((key) => key + 1);
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
							<Space size={4} wrap>
								{actionButtons(detailOrder, false)}
							</Space>
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
					Placed {formatDate(order.createdAt, STORE_TIME_ZONE) ?? "date unavailable"}
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
