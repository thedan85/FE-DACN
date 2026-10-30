"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
	ArrowLeftOutlined,
	CheckOutlined,
	ClockCircleOutlined,
	CustomerServiceOutlined,
	QuestionCircleOutlined,
	TruckOutlined,
} from "@ant-design/icons";
import { Button } from "antd";
import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { getAuthErrorMessage } from "@/features/auth/api";
import {
	formatDate,
	formatVndPrice,
} from "@/features/products/storefront/model/product-format";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import type { OrderStatus } from "@/types";

import { getOrder } from "../api";
import type { OrderPayment, OrderView } from "../api";
import {
	ORDER_STATUS_COPY,
	PAYMENT_STATUS_COPY,
	paymentMethodLabel,
} from "../model/order-display";
import styles from "./order-detail-view.module.css";

const TIMELINE_STEPS = [
	{ key: "placed", title: "Order Placed" },
	{ key: "confirmed", title: "Confirmed" },
	{ key: "shipped", title: "Shipped" },
	{ key: "delivered", title: "Delivered" },
] as const;

const SHIPMENT_COPY: Record<OrderStatus, { title: string; text: string }> = {
	PENDING: {
		title: "Your order is being prepared",
		text: "We'll update this page once your order is confirmed.",
	},
	CONFIRMED: {
		title: "Your order is being prepared",
		text: "We're getting your order ready to ship.",
	},
	SHIPPING: {
		title: "Your order is on its way",
		text: "Your order has left our warehouse.",
	},
	COMPLETED: {
		title: "Your order has been delivered",
		text: "We hope everything arrived safely.",
	},
	CANCELLED: {
		title: "This order was cancelled",
		text: "This order will not be shipped.",
	},
};

type DetailState =
	| { status: "loading" }
	| { status: "not-found" }
	| { status: "error"; message: string }
	| { status: "ready"; order: OrderView };

const timelineFormatter = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

function formatTimelineDate(iso: string | null | undefined): string | null {
	if (!iso) {
		return null;
	}

	const date = new Date(iso);

	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return timelineFormatter.format(date).replace(",", " ·");
}

function activeStepIndex(status: OrderStatus): number {
	switch (status) {
		case "COMPLETED":
			return 3;
		case "SHIPPING":
			return 2;
		case "CONFIRMED":
			return 1;
		default:
			return 0;
	}
}

function stepMeta(index: number, order: OrderView): string {
	const { status } = order;

	if (index === 0) {
		return formatTimelineDate(order.createdAt) ?? "Placed";
	}

	if (index === 3) {
		return status === "COMPLETED"
			? (formatTimelineDate(order.updatedAt) ?? "Delivered")
			: "Pending";
	}

	if (index === 2) {
		if (status === "SHIPPING") {
			return formatTimelineDate(order.updatedAt) ?? "In transit";
		}

		return status === "COMPLETED" ? "Completed" : "Pending";
	}

	if (status === "CONFIRMED") {
		return formatTimelineDate(order.updatedAt) ?? "Completed";
	}

	return status === "SHIPPING" || status === "COMPLETED"
		? "Completed"
		: "Pending";
}

function paymentNote(payment: OrderPayment | null): string | null {
	if (!payment) {
		return null;
	}

	if (payment.paidAt) {
		return `Paid on ${formatDate(payment.paidAt) ?? "recorded date"}`;
	}

	if (payment.method === "COD" && payment.status === "PENDING") {
		return "Payment due on delivery.";
	}

	if (payment.transactionId) {
		return `Transaction ${payment.transactionId}`;
	}

	return null;
}

function paymentBadge(payment: OrderPayment): string {
	if (payment.method === "CREDIT_CARD") {
		return "VN";
	}

	return payment.method === "COD" ? "COD" : "PAY";
}

function PageFrame({ children }: { children: ReactNode }) {
	return (
		<section className={styles.page}>
			<div className={`page-container ${styles.shell}`}>
				<Link href="/account/orders" className={styles.back}>
					<ArrowLeftOutlined aria-hidden="true" />
					Back to My Orders
				</Link>

				<header className={styles.heading}>
					<h1 className={styles.title}>Order Details</h1>
					<p className={styles.subtitle}>
						Follow your order, from our store to your aquarium.
					</p>
				</header>

				{children}
			</div>
		</section>
	);
}

function DeliveryTimeline({ order }: { order: OrderView }) {
	const active = activeStepIndex(order.status);
	const allDone = order.status === "COMPLETED";

	return (
		<ol className={styles.timeline} aria-label="Delivery progress">
			{TIMELINE_STEPS.map((step, index) => {
				const done = allDone || index < active;
				const current = !allDone && index === active;
				const meta = stepMeta(index, order);

				return (
					<li
						key={step.key}
						className={styles.step}
						aria-current={current ? "step" : undefined}
					>
						<div className={styles.markerRow}>
							<span
								className={`${styles.marker} ${
									done
										? styles.markerDone
										: current
											? styles.markerCurrent
											: styles.markerUpcoming
								}`}
							>
								{done ? (
									<CheckOutlined aria-hidden="true" />
								) : current ? (
									step.key === "shipped" ? (
										<TruckOutlined aria-hidden="true" />
									) : (
										<ClockCircleOutlined aria-hidden="true" />
									)
								) : (
									<span className={styles.upcomingDot} />
								)}
							</span>

							{index < TIMELINE_STEPS.length - 1 && (
								<span
									className={`${styles.connector} ${
										done ? styles.connectorDone : styles.connectorUpcoming
									}`}
									aria-hidden="true"
								/>
							)}
						</div>

						<p className={styles.stepTitle}>{step.title}</p>
						<p className={styles.stepMeta}>{meta}</p>
					</li>
				);
			})}
		</ol>
	);
}

function OrderItems({ order }: { order: OrderView }) {
	return (
		<section className={styles.section}>
			<div className={styles.sectionHeading}>
				<h2 className={styles.sectionTitle}>Order items</h2>
				<p className={styles.sectionCount}>
					{order.items.length} {order.items.length === 1 ? "item" : "items"}
				</p>
			</div>

			<ul className={styles.itemsList}>
				{order.items.map((item, index) => (
					<li key={`${item.variantId}-${index}`} className={styles.item}>
						<div className={styles.thumb}>
							{item.thumbnail ? (
								<Image
									src={item.thumbnail}
									alt=""
									fill
									sizes="80px"
									className={styles.thumbImage}
								/>
							) : (
								<MediaPlaceholder label="" />
							)}
						</div>

						<div className={styles.itemInfo}>
							<p className={styles.itemName}>
								{item.productName ?? item.sku}
							</p>
							<p className={styles.itemVariant}>
								{item.attributes.length > 0
									? item.attributes.join(" · ")
									: `SKU ${item.sku}`}{" "}
								×{item.quantity}
							</p>
							<p className={styles.itemUnit}>
								Unit price: {formatVndPrice(item.unitPrice)}
							</p>
						</div>

						<div className={styles.lineTotal}>
							<p className={styles.quantityLabel}>
								Quantity: {item.quantity}
							</p>
							<p className={styles.linePrice}>
								{formatVndPrice(item.unitPrice * item.quantity)}
							</p>
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}

function DeliveryAndPayment({ order }: { order: OrderView }) {
	const note = paymentNote(order.payment);

	return (
		<section className={styles.bottomGrid}>
			<div>
				<h2 className={styles.sectionTitle}>Shipping address</h2>
				<p className={styles.addressName}>{order.recipientName}</p>
				<p className={styles.addressText}>{order.address}</p>
				<p className={styles.addressText}>{order.phone}</p>
			</div>

			<div>
				<h2 className={styles.sectionTitle}>Payment method</h2>

				{order.payment ? (
					<>
						<div className={styles.paymentRow}>
							<span className={styles.paymentBadge} aria-hidden="true">
								{paymentBadge(order.payment)}
							</span>
							<span className={styles.paymentMethod}>
								{paymentMethodLabel(order.payment.method)}
							</span>
							<span
								className={styles.paymentStatus}
								data-status={order.payment.status}
							>
								{PAYMENT_STATUS_COPY[order.payment.status]}
							</span>
						</div>

						{note && <p className={styles.paymentNote}>{note}</p>}
					</>
				) : (
					<p className={styles.paymentNote}>Payment details unavailable.</p>
				)}
			</div>
		</section>
	);
}

function OrderSummary({ order }: { order: OrderView }) {
	const subtotal = order.items.reduce(
		(sum, item) => sum + item.unitPrice * item.quantity,
		0,
	);
	const shipping = Math.max(0, order.total - subtotal);

	return (
		<section className={styles.summaryCard}>
			<h2 className={styles.sectionTitle}>Order summary</h2>

			<div className={styles.summaryRows}>
				<div className={styles.summaryRow}>
					<span>Subtotal</span>
					<span>{formatVndPrice(subtotal)}</span>
				</div>
				<div className={styles.summaryRow}>
					<span>
						Shipping
						{shipping === 0 && (
							<span className={styles.freeTag}> · Free</span>
						)}
					</span>
					<span>{formatVndPrice(shipping)}</span>
				</div>
			</div>

			<div className={styles.summaryDivider} />

			<div className={styles.summaryTotal}>
				<span>Total</span>
				<span>{formatVndPrice(order.total)}</span>
			</div>
		</section>
	);
}

export function OrderDetailView({ orderId }: { orderId: string }) {
	const { status, hydrate } = useAuthStore();
	const [state, setState] = useState<DetailState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		void hydrate();
	}, [hydrate]);

	useEffect(() => {
		if (status !== "authenticated") {
			return;
		}

		let active = true;

		getOrder(orderId)
			.then((order) => {
				if (active) {
					setState({ status: "ready", order });
				}
			})
			.catch((error: unknown) => {
				if (!active) {
					return;
				}

				setState(
					error instanceof ApiError && error.status === 404
						? { status: "not-found" }
						: { status: "error", message: getAuthErrorMessage(error) },
				);
			});

		return () => {
			active = false;
		};
	}, [status, orderId, reloadKey]);

	function retry() {
		setState({ status: "loading" });
		setReloadKey((current) => current + 1);
	}

	if (
		status === "loading" ||
		(status === "authenticated" && state.status === "loading")
	) {
		return (
			<PageFrame>
				<LoadingState
					className={styles.stateCard}
					rows={6}
					label="Loading order details"
				/>
			</PageFrame>
		);
	}

	if (status === "anonymous") {
		return (
			<PageFrame>
				<EmptyState
					className={styles.stateCard}
					title="Sign in to view this order"
					description="Order details are tied to your account."
					action={
						<Button type="primary" href="/login">
							Log In
						</Button>
					}
				/>
			</PageFrame>
		);
	}

	if (state.status === "not-found") {
		return (
			<PageFrame>
				<EmptyState
					className={styles.stateCard}
					title="Order not found"
					description="This order does not exist or belongs to another account."
					action={
						<Button href="/account/orders">Back to My Orders</Button>
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
					title="Could not load this order"
					description={state.message}
					onRetry={retry}
				/>
			</PageFrame>
		);
	}

	if (state.status === "loading") {
		return (
			<PageFrame>
				<LoadingState
					className={styles.stateCard}
					rows={6}
					label="Loading order details"
				/>
			</PageFrame>
		);
	}

	const { order } = state;
	const shipment = SHIPMENT_COPY[order.status];
	const lastUpdated = formatDate(order.updatedAt);
	const placedOn = formatDate(order.createdAt);

	return (
		<PageFrame>
			<div className={styles.reference}>
				<h2 className={styles.orderId}>Order #{order.orderId}</h2>
				<span className={styles.status} data-status={order.status}>
					<span className={styles.statusDot} aria-hidden="true" />
					{ORDER_STATUS_COPY[order.status]}
				</span>
				<p className={styles.placedOn}>
					{placedOn ? `Placed on ${placedOn}` : "Date unavailable"}
				</p>
			</div>

			<div className={styles.layout}>
				<div className={styles.mainCard}>
					<section>
						<h2 className={styles.sectionTitle}>Order status</h2>
						{order.status === "CANCELLED" ? (
							<p className={styles.cancelledNote}>
								This order was cancelled
								{lastUpdated ? ` on ${lastUpdated}` : ""}.
							</p>
						) : (
							<DeliveryTimeline order={order} />
						)}
					</section>

					<div className={styles.divider} />
					<OrderItems order={order} />

					<div className={styles.divider} />
					<DeliveryAndPayment order={order} />
				</div>

				<div className={styles.side}>
					<section className={styles.shipmentCard}>
						<div className={styles.shipmentHead}>
							<TruckOutlined
								className={styles.shipmentIcon}
								aria-hidden="true"
							/>
							<div>
								<h2 className={styles.shipmentTitle}>{shipment.title}</h2>
								<p className={styles.shipmentText}>{shipment.text}</p>
							</div>
						</div>

						<p className={styles.shipmentMeta}>
							{lastUpdated
								? `Last updated ${lastUpdated}`
								: "No delivery updates yet"}
						</p>

						<Link href="/contact" className={styles.shipmentAction}>
							<CustomerServiceOutlined aria-hidden="true" />
							Contact Support
						</Link>
					</section>

					<OrderSummary order={order} />
				</div>
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
