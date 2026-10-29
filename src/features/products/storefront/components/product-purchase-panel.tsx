"use client";

import { useState } from "react";
import Link from "next/link";
import { App, Alert } from "antd";

import { addToCart } from "../../api/cart.api";
import type { VariantDetail } from "../../types";
import { formatVndPrice } from "../model/product-format";
import { variantSoldOut } from "../model/product-stock";

import styles from "./product-purchase-panel.module.css";

type ProductPurchasePanelProps = {
	variant: VariantDetail;
};

type Notice = { kind: "auth" } | { kind: "error"; text: string };

/**
 * Price row, quantity stepper and Add to cart — the purchase subsection of
 * the reference design.
 *
 * Decision D13 still holds: `POST /cart/items` is called for real; a 401 (the
 * norm while signed out) renders a "Sign in to purchase" notice with a
 * `/login` link instead of pretending the item was added. Every other failure
 * surfaces the backend's message. No fake success, no silent failure.
 *
 * The parent keys this component on `variant.variantId`, so switching
 * variants remounts it and every piece of local state (quantity, notice,
 * in-flight flag) starts fresh — no effect-based resynchronisation needed.
 */
export function ProductPurchasePanel({
	variant,
}: ProductPurchasePanelProps) {
	const { message } = App.useApp();

	const [quantity, setQuantity] = useState(1);
	const [submitting, setSubmitting] = useState(false);
	const [notice, setNotice] = useState<Notice | null>(null);

	const soldOut = variantSoldOut(variant);
	const canSubmit = !soldOut && quantity >= 1 && !submitting;

	function decreaseQuantity() {
		setQuantity((current) => Math.max(1, current - 1));
	}

	function increaseQuantity() {
		setQuantity((current) =>
			Math.min(Math.max(variant.stock, 1), current + 1),
		);
	}

	async function handleAddToCart() {
		if (!canSubmit) {
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
			<p className={styles.price}>{formatVndPrice(variant.price)}</p>

			<div className={styles.actions}>
				<div
					className={styles.stepper}
					role="group"
					aria-label="Quantity"
				>
					<button
						type="button"
						className={styles.stepButton}
						aria-label="Decrease quantity"
						disabled={soldOut || quantity <= 1}
						onClick={decreaseQuantity}
					>
						−
					</button>
					<output className={styles.quantity} aria-live="polite">
						{quantity}
					</output>
					<button
						type="button"
						className={styles.stepButton}
						aria-label="Increase quantity"
						disabled={soldOut || quantity >= variant.stock}
						onClick={increaseQuantity}
					>
						+
					</button>
				</div>

				<button
					type="button"
					className={styles.addButton}
					aria-busy={submitting}
					disabled={!canSubmit}
					onClick={handleAddToCart}
				>
					{submitting ? "ADDING…" : "ADD TO CART"}
				</button>
			</div>

			{soldOut && (
				<p className={styles.soldOut}>This variant is out of stock.</p>
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
							You need an account before items can be added to your
							cart.{" "}
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
							{notice.text} Check your connection and try again with
							the button above.
						</>
					}
				/>
			)}
		</div>
	);
}
