"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
	ArrowRightOutlined,
	DeleteOutlined,
	ExperimentOutlined,
	LockOutlined,
	SafetyCertificateOutlined,
	TruckOutlined,
} from "@ant-design/icons";
import { App, Button, Tag } from "antd";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { getAuthErrorMessage } from "@/features/auth/api/auth.api";
import { formatVndPrice } from "@/features/products/storefront/model/product-format";

import { removeCartItem, updateCartItem } from "../../api/cart.api";
import type { Cart, CartItem } from "../../types";
import { useCart } from "../hooks/use-cart";
import styles from "./cart-view.module.css";

function replaceItem(cart: Cart, updated: CartItem): Cart {
	const items = cart.items.map((item) =>
		item.cartItemId === updated.cartItemId ? updated : item,
	);

	return {
		...cart,
		items,
		totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
		totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
	};
}

function CartFrame({
	count,
	children,
}: {
	count?: number | null;
	children: ReactNode;
}) {
	return (
		<section className={styles.page}>
			<div className={`page-container ${styles.container}`}>
				<header className={styles.intro}>
					{count != null && (
						<p className={styles.eyebrow}>
							<span className={styles.dot} aria-hidden="true" />
							{count} {count === 1 ? "item" : "items"} in your cart
							<span className={styles.eyebrowDivider} aria-hidden="true">
								|
							</span>
							Aquatic Husbandry Direct
						</p>
					)}
					<h1>Your Cart</h1>
					<p>Review your aquarium essentials before checkout.</p>
				</header>

				{children}
			</div>
		</section>
	);
}

export function CartView() {
	const { state, reload, setCart } = useCart();
	const { message } = App.useApp();
	const [busyItemId, setBusyItemId] = useState<string | null>(null);

	if (state.status === "loading") {
		return (
			<CartFrame>
				<LoadingState className={styles.stateCard} rows={6} label="Loading cart" />
			</CartFrame>
		);
	}

	if (state.status === "anonymous") {
		return (
			<CartFrame>
				<EmptyState
					className={styles.stateCard}
					title="Sign in to view your cart"
					description="Your cart is tied to your account. Sign in to keep shopping where you left off."
					action={
						<Button type="primary" href="/login">
							Log In
						</Button>
					}
				/>
			</CartFrame>
		);
	}

	if (state.status === "error") {
		return (
			<CartFrame>
				<ErrorState
					className={styles.stateCard}
					title="Could not load your cart"
					description={state.message}
					onRetry={reload}
				/>
			</CartFrame>
		);
	}

	const { cart } = state;

	async function changeQuantity(item: CartItem, next: number) {
		if (busyItemId || next < 1 || next > item.stock) {
			return;
		}

		setBusyItemId(item.cartItemId);

		try {
			const updated = await updateCartItem(item.cartItemId, next);
			setCart(replaceItem(cart, updated));
		} catch (error) {
			message.error(getAuthErrorMessage(error));
		} finally {
			setBusyItemId(null);
		}
	}

	async function removeItem(item: CartItem) {
		if (busyItemId) {
			return;
		}

		setBusyItemId(item.cartItemId);

		try {
			await removeCartItem(item.cartItemId);
			const items = cart.items.filter(
				(line) => line.cartItemId !== item.cartItemId,
			);
			setCart({
				...cart,
				items,
				totalQuantity: items.reduce(
					(sum, line) => sum + line.quantity,
					0,
				),
				totalAmount: items.reduce(
					(sum, line) => sum + line.lineTotal,
					0,
				),
			});
			message.success(`Removed ${item.productName} from your cart.`);
		} catch (error) {
			message.error(getAuthErrorMessage(error));
		} finally {
			setBusyItemId(null);
		}
	}

	if (cart.items.length === 0) {
		return (
			<CartFrame count={0}>
				<EmptyState
					className={styles.stateCard}
					title="Your cart is empty"
					description="Add a few aquarium essentials and they will show up here."
					action={
						<Button type="primary" href="/products">
							Browse Products
						</Button>
					}
				/>
			</CartFrame>
		);
	}

	const hasUnavailableItem = cart.items.some(
		(item) => item.stock < item.quantity,
	);

	return (
		<CartFrame count={cart.totalQuantity}>
			<div className={styles.layout}>
				<div className={styles.mainColumn}>
					<div className={styles.itemsCard}>
						<div className={styles.tableHead} aria-hidden="true">
							<span className={styles.headItem}>Item &amp; Spec</span>
							<span>Quantity</span>
							<span>Subtotal</span>
							<span />
						</div>

						<ul className={styles.items}>
							{cart.items.map((item) => {
								const busy = busyItemId === item.cartItemId;

								return (
									<li key={item.cartItemId} className={styles.item}>
										<div className={styles.thumb}>
											{item.thumbnail ? (
												<Image
													src={item.thumbnail}
													alt={item.productName}
													fill
													sizes="96px"
													className={styles.thumbImage}
												/>
											) : (
												<MediaPlaceholder label="" />
											)}
										</div>

										<div className={styles.itemInfo}>
											<h2 className={styles.itemName}>{item.productName}</h2>
											<p className={styles.itemMeta}>SKU: {item.sku}</p>
											<p className={styles.itemPrice}>
												{formatVndPrice(item.price)} each
											</p>
											{item.stock < 1 && (
												<p className={styles.stockWarning}>
													Out of stock
												</p>
											)}
										</div>

										<div
											className={styles.stepper}
											role="group"
											aria-label={`Quantity for ${item.productName}`}
										>
											<button
												type="button"
												className={styles.stepButton}
												aria-label={`Decrease quantity for ${item.productName}`}
												disabled={busy || item.stock < 1 || item.quantity <= 1}
												onClick={() =>
													void changeQuantity(item, item.quantity - 1)
												}
											>
												−
											</button>
											<output className={styles.quantity} aria-live="polite">
												{item.quantity}
											</output>
											<button
												type="button"
												className={styles.stepButton}
												aria-label={`Increase quantity for ${item.productName}`}
												disabled={
													busy ||
													item.stock < 1 ||
													item.quantity >= item.stock
												}
												onClick={() =>
													void changeQuantity(item, item.quantity + 1)
												}
											>
												+
											</button>
										</div>

										<p className={styles.lineTotal}>
											{formatVndPrice(item.lineTotal)}
										</p>

										<button
											type="button"
											className={styles.removeButton}
											aria-label={`Remove ${item.productName} from cart`}
											disabled={busy}
											onClick={() => void removeItem(item)}
										>
											<DeleteOutlined />
										</button>
									</li>
								);
							})}
						</ul>
					</div>

					<div className={styles.assuranceCard}>
						<SafetyCertificateOutlined className={styles.assuranceIcon} />
						<div>
							<h2>100% Live Arrival Guarantee</h2>
							<p>
								Live livestock orders are carefully packed for safe
								transport with climate-controlled packaging, oxygenation
								buffers, and heating or ice packs according to current
								regional weather.
							</p>
						</div>
					</div>

					<div className={styles.assuranceCard}>
						<ExperimentOutlined className={styles.assuranceIcon} />
						<div>
							<h2>Biotope Compatibility Check</h2>
							<p>
								Selected species share harmonious water parameters (soft to
								neutral, 22–26°C).
							</p>
						</div>
						<Tag color="green" className={styles.compatibilityTag}>
							100% Cohabitation Safe
						</Tag>
					</div>
				</div>

				<aside className={styles.summary} aria-labelledby="cart-summary-title">
					<h2 id="cart-summary-title">Order Summary</h2>
					<p className={styles.summaryNote}>
						Dispatching from verified aquatic nursery
					</p>

					<div className={styles.summaryRow}>
						<span>Subtotal</span>
						<span>{formatVndPrice(cart.totalAmount)}</span>
					</div>

					<div className={styles.totalRow}>
						<span>Total</span>
						<strong>{formatVndPrice(cart.totalAmount)}</strong>
					</div>

					<Link
						href="/checkout"
						className={`${styles.checkoutLink} ${
							hasUnavailableItem ? styles.checkoutLinkDisabled : ""
						}`}
						aria-disabled={hasUnavailableItem || undefined}
						tabIndex={hasUnavailableItem ? -1 : undefined}
						onClick={(event) => {
							if (hasUnavailableItem) {
								event.preventDefault();
							}
						}}
					>
						Proceed to Checkout <ArrowRightOutlined />
					</Link>

					{hasUnavailableItem && (
						<p className={styles.stockWarning}>
							Adjust or remove items that are no longer available in the
							requested quantity before checking out.
						</p>
					)}

					<Link href="/products" className={styles.continueLink}>
						← Continue Shopping
					</Link>

					<ul className={styles.trustList}>
						<li>
							<LockOutlined /> Secure checkout with 256-bit encryption
						</li>
						<li>
							<SafetyCertificateOutlined /> Healthy livestock guarantee
							(14-day quarantine)
						</li>
						<li>
							<TruckOutlined /> Carefully packed climate-controlled
							shipping
						</li>
					</ul>
				</aside>
			</div>
		</CartFrame>
	);
}
