"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Image, Modal, Skeleton, Typography } from "antd";

import { getAuthErrorMessage } from "@/features/auth/api/auth.api";
import { formatVndPrice } from "@/features/products/storefront/model/product-format";
import { ApiError } from "@/lib/api/client";

import { createVietQrPayment } from "../../api/payments.api";
import type { PaymentVietQr } from "../../schema/payment.schema";
import styles from "./vietqr-payment-modal.module.css";

type QrState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; payment: PaymentVietQr }
	| { status: "error"; message: string; retryable: boolean };

type FetchResult =
	| { status: "ready"; payment: PaymentVietQr; requestKey: number }
	| { status: "error"; message: string; retryable: boolean; requestKey: number };

function mapPaymentError(error: unknown): { message: string; retryable: boolean } {
	if (error instanceof ApiError) {
		if (error.status === 503) {
			return { message: "VietQR is not configured. Contact the shop.", retryable: false };
		}

		if (error.status === 400) {
			return {
				message: "This order is no longer awaiting VietQR payment. Refresh your order history to see its current status.",
				retryable: false,
			};
		}

		if (error.status === 404) {
			return { message: "Order or payment not found.", retryable: false };
		}

		if (error.status >= 400 && error.status < 500) {
			return { message: getAuthErrorMessage(error), retryable: false };
		}
	}

	// Network failures (status 0), other 5xx, and non-API errors are retryable.
	return { message: getAuthErrorMessage(error), retryable: true };
}

/**
 * The success block owns the image-error flag and the image remount key, so
 * closing unmounts it (destroyOnHidden) and a reopen always starts clean.
 */
function VietQrSuccess({
	payment,
	orderId,
}: {
	payment: PaymentVietQr;
	orderId: string;
}) {
	const [imageFailed, setImageFailed] = useState(false);
	const [imageKey, setImageKey] = useState(0);

	return (
		<>
			<Typography.Paragraph type="secondary">
				Scan the QR with your banking app. The shop confirms your payment after
				the transfer arrives.
			</Typography.Paragraph>
			<div className={styles.body}>
				{imageFailed ? (
					<div className={styles.fallback}>
						<Typography.Text type="danger">
							QR image could not load.
						</Typography.Text>
						<Button
							onClick={() => {
								setImageKey((key) => key + 1);
								setImageFailed(false);
							}}
						>
							Retry image
						</Button>
					</div>
				) : (
					<Image
						key={imageKey}
						className={styles.qr}
						src={payment.qrUrl}
						alt={`VietQR code for order ${orderId}`}
						preview={false}
						width={200}
						height={200}
						onError={() => setImageFailed(true)}
					/>
				)}
				<div className={styles.details}>
					<div className={styles.row}>
						<Typography.Text type="secondary" className={styles.label}>
							Amount
						</Typography.Text>
						<span className={styles.value}>
							{formatVndPrice(payment.amount)}
						</span>
					</div>
					<div className={styles.row}>
						<Typography.Text type="secondary" className={styles.label}>
							Bank
						</Typography.Text>
						<span className={styles.value}>{payment.bankId}</span>
					</div>
					<div className={styles.row}>
						<Typography.Text type="secondary" className={styles.label}>
							Account number
						</Typography.Text>
						<span className={styles.value}>{payment.accountNo}</span>
					</div>
					<div className={styles.row}>
						<Typography.Text type="secondary" className={styles.label}>
							Account name
						</Typography.Text>
						<span className={styles.value}>{payment.accountName}</span>
					</div>
					<div className={styles.row}>
						<Typography.Text type="secondary" className={styles.label}>
							Transfer note
						</Typography.Text>
						<Typography.Text copyable className={styles.value}>
							{payment.addInfo}
						</Typography.Text>
					</div>
				</div>
			</div>
		</>
	);
}

/**
 * Shows the VietQR code and bank details for one order awaiting payment.
 * Fetches once per open transition; image reloads never touch the API.
 */
export function VietQrPaymentModal({
	orderId,
	open,
	onClose,
}: {
	orderId: string | null;
	open: boolean;
	onClose: () => void;
}) {
	const canFetch = open && orderId !== null;
	const [result, setResult] = useState<FetchResult | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [prevOpen, setPrevOpen] = useState(open);

	// Reset to idle when the modal closes, so a reopen starts clean.
	if (prevOpen !== open) {
		setPrevOpen(open);
		if (!open && result !== null) {
			setResult(null);
		}
	}

	useEffect(() => {
		if (!open || orderId === null) {
			return;
		}

		let active = true;
		createVietQrPayment(orderId)
			.then((payment) => {
				if (active) {
					setResult({ status: "ready", payment, requestKey: attempt });
				}
			})
			.catch((error: unknown) => {
				if (active) {
					setResult({ status: "error", ...mapPaymentError(error), requestKey: attempt });
				}
			});

		return () => {
			active = false;
		};
	}, [open, orderId, attempt]);

	// Loading is derived: a result only counts for the attempt that requested it.
	const state: QrState = !canFetch
		? { status: "idle" }
		: result && result.requestKey === attempt
			? result
			: { status: "loading" };

	return (
		<Modal
			title="VietQR payment"
			open={open}
			onCancel={onClose}
			destroyOnHidden
			footer={<Button onClick={onClose}>Close</Button>}
		>
			{state.status === "error" ? (
				<Alert
					type="error"
					showIcon
					title={state.message}
					action={
						state.retryable ? (
							<Button onClick={() => setAttempt((value) => value + 1)}>
								Retry
							</Button>
						) : undefined
					}
				/>
			) : state.status === "ready" && orderId !== null ? (
				<VietQrSuccess payment={state.payment} orderId={orderId} />
			) : (
				<Skeleton active paragraph={{ rows: 4 }} />
			)}
		</Modal>
	);
}
