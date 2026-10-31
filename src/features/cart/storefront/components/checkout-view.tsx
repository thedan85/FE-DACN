"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	CheckCircleOutlined,
	LockOutlined,
	SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Alert, App, Button, Input } from "antd";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { getAuthErrorMessage } from "@/features/auth/api/auth.api";
import type { MeData } from "@/features/auth/types";
import { formatVndPrice } from "@/features/products/storefront/model/product-format";
import { useAuthStore } from "@/stores/auth-store";

import { checkoutCart, createVnpayPaymentUrl } from "../../api/cart.api";
import { useCart } from "../hooks/use-cart";
import styles from "./checkout-view.module.css";

const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;

type PaymentChoice = "CREDIT_CARD" | "COD";

type CheckoutForm = {
	recipientName: string;
	phone: string;
	address: string;
};

type CheckoutErrors = Partial<Record<keyof CheckoutForm, string>>;

const PAYMENT_OPTIONS: {
	value: PaymentChoice;
	title: string;
	description: string;
	badge: string;
}[] = [
	{
		value: "CREDIT_CARD",
		title: "VN Pay",
		description: "Pay by card or QR code with VN Pay",
		badge: "VNP",
	},
	{
		value: "COD",
		title: "COD – Cash on Delivery",
		description: "Pay when you receive your order",
		badge: "COD",
	},
];

function formFromUser(user: MeData | null): CheckoutForm {
	return {
		recipientName: user?.name ?? "",
		phone: user?.phone ?? "",
		address: user?.address ?? "",
	};
}

function validate(form: CheckoutForm): CheckoutErrors {
	const errors: CheckoutErrors = {};
	const recipientName = form.recipientName.trim();
	const phone = form.phone.trim();
	const address = form.address.trim();

	if (!recipientName) {
		errors.recipientName = "Recipient name is required.";
	} else if (recipientName.length > 255) {
		errors.recipientName = "Recipient name must be 255 characters or fewer.";
	}

	if (!phone) {
		errors.phone = "Phone number is required.";
	} else if (!PHONE_PATTERN.test(phone)) {
		errors.phone = "Enter 10-15 digits, optionally starting with +.";
	}

	if (!address) {
		errors.address = "Delivery address is required.";
	} else if (address.length > 500) {
		errors.address = "Address must be 500 characters or fewer.";
	}

	return errors;
}

function isSafeRedirect(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" || parsed.protocol === "http:";
	} catch {
		return false;
	}
}

function CheckoutFrame({ children }: { children: ReactNode }) {
	return (
		<section className={styles.page}>
			<div className="page-container">
				<header className={styles.intro}>
					<h1>Checkout</h1>
					<p>Confirm your delivery details and place your order.</p>
				</header>

				{children}
			</div>
		</section>
	);
}

type SubmitError = {
	message: string;
	/** Set when the order exists but the payment redirect could not start. */
	orderId?: string;
};

export function CheckoutView() {
	const { state, reload } = useCart();
	const { user } = useAuthStore();
	const router = useRouter();
	const { message } = App.useApp();

	const [form, setForm] = useState<CheckoutForm>(() => formFromUser(user));
	const [syncedUserId, setSyncedUserId] = useState(user?.userId ?? null);
	const [errors, setErrors] = useState<CheckoutErrors>({});
	const [payment, setPayment] = useState<PaymentChoice>("CREDIT_CARD");
	const [submitting, setSubmitting] = useState(false);
	const [orderPlaced, setOrderPlaced] = useState(false);
	const [submitError, setSubmitError] = useState<SubmitError | null>(null);

	// Prefill once the profile finishes hydrating, without discarding edits
	// the customer may have made in the meantime.
	if (user && syncedUserId !== user.userId) {
		setSyncedUserId(user.userId);
		setForm(formFromUser(user));
		setErrors({});
	}

	if (state.status === "loading") {
		return (
			<CheckoutFrame>
				<LoadingState className={styles.stateCard} rows={6} label="Loading checkout" />
			</CheckoutFrame>
		);
	}

	if (state.status === "anonymous") {
		return (
			<CheckoutFrame>
				<EmptyState
					className={styles.stateCard}
					title="Sign in to check out"
					description="Sign in to use your saved details and place an order."
					action={
						<Button type="primary" href="/login">
							Log In
						</Button>
					}
				/>
			</CheckoutFrame>
		);
	}

	if (state.status === "error") {
		return (
			<CheckoutFrame>
				<ErrorState
					className={styles.stateCard}
					title="Could not load your cart"
					description={state.message}
					onRetry={reload}
				/>
			</CheckoutFrame>
		);
	}

	const { cart } = state;

	if (cart.items.length === 0) {
		return (
			<CheckoutFrame>
				<EmptyState
					className={styles.stateCard}
					title="Your cart is empty"
					description="Add something to your cart before checking out."
					action={
						<Button type="primary" href="/products">
							Browse Products
						</Button>
					}
				/>
			</CheckoutFrame>
		);
	}

	function updateField(field: keyof CheckoutForm, value: string) {
		setForm((current) => ({ ...current, [field]: value }));
		setErrors((current) => ({ ...current, [field]: undefined }));
		setSubmitError(null);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (submitting || orderPlaced) {
			return;
		}

		const nextErrors = validate(form);
		if (Object.keys(nextErrors).length > 0) {
			setErrors(nextErrors);
			setSubmitError(null);
			return;
		}

		setErrors({});
		setSubmitError(null);
		setSubmitting(true);

		let orderId: string;

		try {
			const order = await checkoutCart({
				recipientName: form.recipientName.trim(),
				phone: form.phone.trim(),
				address: form.address.trim(),
				method: payment,
			});
			orderId = order.orderId;
			setOrderPlaced(true);
		} catch (error) {
			setSubmitError({ message: getAuthErrorMessage(error) });
			setSubmitting(false);
			return;
		}

		if (payment === "COD") {
			message.success(`Order ${orderId} placed successfully.`);
			router.replace("/account/orders");
			return;
		}

		try {
			const payUrl = await createVnpayPaymentUrl(orderId);
			if (!isSafeRedirect(payUrl)) {
				throw new Error("Unsafe payment URL.");
			}
			window.location.assign(payUrl);
		} catch {
			setSubmitError({
				message:
					"Your order was placed, but we could not open the VN Pay payment page.",
				orderId,
			});
			setSubmitting(false);
		}
	}

	return (
		<CheckoutFrame>
			<form className={styles.layout} onSubmit={handleSubmit} noValidate>
				<div className={styles.formColumn}>
					<section className={styles.card} aria-labelledby="shipping-heading">
						<div className={styles.cardHeading}>
							<span className={styles.stepNumber} aria-hidden="true">
								1
							</span>
							<h2 id="shipping-heading">Shipping Information</h2>
						</div>

						<div className={styles.fields}>
							<Field
								label="Recipient Name"
								htmlFor="checkout-name"
								className={styles.fullField}
								error={errors.recipientName}
							>
								<Input
									id="checkout-name"
									name="name"
									value={form.recipientName}
									onChange={(event) =>
										updateField("recipientName", event.target.value)
									}
									autoComplete="name"
									maxLength={255}
									status={errors.recipientName ? "error" : undefined}
									aria-invalid={errors.recipientName ? true : undefined}
								/>
							</Field>

							<Field
								label="Phone Number"
								htmlFor="checkout-phone"
								error={errors.phone}
							>
								<Input
									id="checkout-phone"
									name="phone"
									value={form.phone}
									onChange={(event) =>
										updateField("phone", event.target.value)
									}
									autoComplete="tel"
									inputMode="tel"
									maxLength={16}
									status={errors.phone ? "error" : undefined}
									aria-invalid={errors.phone ? true : undefined}
								/>
							</Field>

							<Field
								label="Street Address"
								htmlFor="checkout-address"
								className={styles.fullField}
								error={errors.address}
							>
								<Input.TextArea
									id="checkout-address"
									name="address"
									value={form.address}
									onChange={(event) =>
										updateField("address", event.target.value)
									}
									autoComplete="street-address"
									rows={3}
									maxLength={500}
									aria-invalid={errors.address ? true : undefined}
								/>
							</Field>
						</div>
					</section>

					<section className={styles.card} aria-labelledby="payment-heading">
						<div className={styles.cardHeading}>
							<span className={styles.stepNumber} aria-hidden="true">
								2
							</span>
							<h2 id="payment-heading">Payment Details</h2>
						</div>

						<fieldset className={styles.paymentOptions}>
							<legend className={styles.srOnly}>Payment method</legend>

							{PAYMENT_OPTIONS.map((option) => (
								<label
									key={option.value}
									className={`${styles.paymentOption} ${
										payment === option.value ? styles.paymentSelected : ""
									}`}
								>
									<input
										type="radio"
										name="paymentMethod"
										value={option.value}
										checked={payment === option.value}
										onChange={() => setPayment(option.value)}
										className={styles.radio}
									/>
									<span className={styles.paymentText}>
										<strong>{option.title}</strong>
										<span>{option.description}</span>
									</span>
									<span className={styles.paymentBadge} aria-hidden="true">
										{option.badge}
									</span>
								</label>
							))}
						</fieldset>
					</section>

					{submitError && (
						<Alert
							type="error"
							showIcon
							role="alert"
							message={
								submitError.orderId
									? `Order ${submitError.orderId} was created`
									: "Could not place your order"
							}
							description={
								<>
									{submitError.message}
									{submitError.orderId && (
										<>
											{" "}
											<Link
												className={styles.errorLink}
												href="/account/orders"
											>
												View your orders
											</Link>
										</>
									)}
								</>
							}
						/>
					)}
				</div>

				<aside className={styles.summary} aria-labelledby="checkout-summary-title">
					<h2 id="checkout-summary-title">Order Summary</h2>

					<ul className={styles.summaryItems}>
						{cart.items.map((item) => (
							<li key={item.cartItemId} className={styles.summaryItem}>
								<div className={styles.summaryThumb}>
									{item.thumbnail ? (
										<Image
											src={item.thumbnail}
											alt={item.productName}
											fill
											sizes="56px"
											className={styles.summaryImage}
										/>
									) : (
										<MediaPlaceholder label="" />
									)}
								</div>

								<div className={styles.summaryInfo}>
									<strong>{item.productName}</strong>
									<span>SKU: {item.sku}</span>
									<span>
										{item.quantity} × {formatVndPrice(item.price)}
									</span>
								</div>

								<span className={styles.summaryLineTotal}>
									{formatVndPrice(item.lineTotal)}
								</span>
							</li>
						))}
					</ul>

					<div className={styles.summaryRow}>
						<span>Subtotal</span>
						<span>{formatVndPrice(cart.totalAmount)}</span>
					</div>

					<div className={styles.totalRow}>
						<span>Total</span>
						<strong>{formatVndPrice(cart.totalAmount)}</strong>
					</div>

					<Button
						type="primary"
						htmlType="submit"
						block
						loading={submitting}
						disabled={submitting || orderPlaced}
						className={styles.placeOrder}
					>
						Place Order ({formatVndPrice(cart.totalAmount)})
					</Button>

					<ul className={styles.trustList}>
						<li>
							<CheckCircleOutlined /> Secure SSL Encrypted Checkout
						</li>
						<li>
							<SafetyCertificateOutlined /> 100% Live Arrival Guarantee
							Active
						</li>
						<li>
							<LockOutlined /> Your details are only used to fulfil this
							order
						</li>
					</ul>
				</aside>
			</form>
		</CheckoutFrame>
	);
}

function Field({
	label,
	htmlFor,
	className,
	error,
	children,
}: {
	label: string;
	htmlFor: string;
	className?: string;
	error?: string;
	children: React.ReactNode;
}) {
	return (
		<div className={`${styles.field} ${className ?? ""}`}>
			<label htmlFor={htmlFor}>{label}</label>
			{children}
			{error != null && (
				<span className={styles.fieldError} role="alert">
					{error}
				</span>
			)}
		</div>
	);
}
