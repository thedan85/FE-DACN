"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCartOutlined } from "@ant-design/icons";
import { App, Alert, Button, InputNumber } from "antd";

import { addToCart } from "../../api/cart.api";
import type { VariantDetail } from "../../types";
import { variantSoldOut } from "../model/product-stock";

import styles from "./product-purchase-panel.module.css";

type ProductPurchasePanelProps = {
	variant: VariantDetail;
};

type Notice =
	| { kind: "auth" }
	| { kind: "error"; text: string };

/**
 * Section 2 purchase subsection — quantity + Add to cart (criteria §2).
 *
 * Decision D13: the flow is fully implemented with an **honest auth gate**.
 * `POST /cart/items` is called for real; a 401 (the norm while signed out)
 * renders a "Sign in to purchase" notice with a `/login` link instead of
 * pretending the item was added. Every other failure surfaces the backend's
 * message. No fake success, no silent failure.
 *
 * "Buy Now" is deliberately absent — the team decided not to implement it
 * (decision D14) and there is no backend contract for it.
 *
 * The parent keys this component on `variant.variantId`, so switching
 * variants remounts it and every piece of local state (quantity, notice,
 * in-flight flag) starts fresh — no effect-based resynchronisation needed.
 */
export function ProductPurchasePanel({
	variant,
}: ProductPurchasePanelProps) {
	const { message } = App.useApp();

	const [quantity, setQuantity] = useState<number | null>(1);
	const [submitting, setSubmitting] = useState(false);
	const [notice, setNotice] = useState<Notice | null>(null);

	const soldOut = variantSoldOut(variant);
	const maxQuantity = Math.max(variant.stock, 1);
	const quantityValid =
		quantity != null &&
		Number.isInteger(quantity) &&
		quantity >= 1 &&
		quantity <= variant.stock;
	const canSubmit = !soldOut && quantityValid && !submitting;

	async function handleAddToCart() {
		if (!canSubmit || quantity == null) {
			return;
		}

		setSubmitting(true);
		setNotice(null);

		const outcome = await addToCart({
			variantId: variant.variantId,
			quantity,
		});

		if (outcome.status === "added") {
			message.success(
				`Added ${outcome.item.quantity} × ${outcome.item.sku} to your cart.`,
			);
		} else if (outcome.status === "auth-required") {
			setNotice({ kind: "auth" });
		} else {
			setNotice({ kind: "error", text: outcome.message });
		}

		setSubmitting(false);
	}

	return (
		<div className={styles.root}>
			<div className={styles.controls}>
				<div className={styles.quantity}>
					<label
						className={styles.quantityLabel}
						htmlFor="variant-quantity"
					>
						Quantity
					</label>
					<InputNumber
						id="variant-quantity"
						className={styles.quantityInput}
						min={1}
						max={maxQuantity}
						step={1}
						precision={0}
						value={quantity}
						disabled={soldOut}
						aria-label="Quantity"
						onChange={(value) => setQuantity(value)}
					/>
				</div>

				<Button
					type="primary"
					className={styles.addButton}
					icon={<ShoppingCartOutlined />}
					loading={submitting}
					disabled={!canSubmit}
					onClick={handleAddToCart}
				>
					Add to cart
				</Button>
			</div>

			{soldOut && (
				<p className={styles.soldOut}>
					This variant is out of stock.
				</p>
			)}

			{notice?.kind === "auth" && (
				<Alert
					className={styles.notice}
					role="alert"
					type="warning"
					showIcon
					message="Sign in to purchase"
					description={
						<>
							You need an account before items can be added to
							your cart.{" "}
							<Link className={styles.signInLink} href="/login">
								Sign in
							</Link>
						</>
					}
				/>
			)}

			{notice?.kind === "error" && (
				<Alert
					className={styles.notice}
					role="alert"
					type="error"
					showIcon
					message="Could not add to cart"
					description={
						<>
							{notice.text} Check your connection and try again
							with the button above.
						</>
					}
				/>
			)}
		</div>
	);
}
