"use client";

import {
	CheckCircleOutlined,
	DeleteOutlined,
	ExclamationCircleOutlined,
	LockOutlined,
	LogoutOutlined,
	WarningOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { FeedbackDialog } from "./feedback-dialog";

type DialogBaseProps = {
	open: boolean;
	onClose: () => void;
};

type PaymentSuccessDialogProps = DialogBaseProps & {
	orderNumber?: string;
	onViewOrder?: () => void;
	onContinueShopping?: () => void;
};

export function PaymentSuccessDialog({
	open,
	onClose,
	orderNumber,
	onViewOrder,
	onContinueShopping,
}: PaymentSuccessDialogProps) {
	const description: ReactNode = orderNumber ? (
		<>
			Your payment has been completed successfully. Your order{" "}
			<strong>#{orderNumber}</strong> is being processed.
		</>
	) : (
		"Your payment has been completed successfully."
	);

	return (
		<FeedbackDialog
			open={open}
			variant="success"
			icon={<CheckCircleOutlined />}
			title="Payment Successful"
			description={description}
			showCloseButton
			onClose={onClose}
			actions={[
				{
					label: "View Order",
					onClick: onViewOrder ?? onClose,
				},
				{
					label: "Continue Shopping",
					variant: "secondary",
					onClick: onContinueShopping ?? onClose,
				},
			]}
		/>
	);
}

type PaymentFailedDialogProps = DialogBaseProps & {
	onRetry?: () => void;
};

export function PaymentFailedDialog({
	open,
	onClose,
	onRetry,
}: PaymentFailedDialogProps) {
	return (
		<FeedbackDialog
			open={open}
			variant="error"
			icon={<ExclamationCircleOutlined />}
			title="Payment Failed"
			description="We couldn't complete your payment. Please check your payment details and try again."
			showCloseButton
			onClose={onClose}
			actions={[
				{
					label: "Try Again",
					onClick: onRetry ?? onClose,
				},
				{
					label: "Cancel",
					variant: "secondary",
					onClick: onClose,
				},
			]}
		/>
	);
}

type LogoutDialogProps = DialogBaseProps & {
	onConfirm: () => void | Promise<void>;
};

export function LogoutDialog({ open, onClose, onConfirm }: LogoutDialogProps) {
	async function handleConfirm() {
		await onConfirm();
		onClose();
	}

	return (
		<FeedbackDialog
			open={open}
			variant="warning"
			icon={<LogoutOutlined />}
			title="Log out?"
			description="Are you sure you want to log out of your Aquarium Store account?"
			showCloseButton
			onClose={onClose}
			actions={[
				{
					label: "Log Out",
					variant: "danger",
					onClick: handleConfirm,
				},
				{
					label: "Cancel",
					variant: "secondary",
					onClick: onClose,
				},
			]}
		/>
	);
}

type LoginRequiredDialogProps = DialogBaseProps & {
	onSignIn: () => void;
};

export function LoginRequiredDialog({
	open,
	onClose,
	onSignIn,
}: LoginRequiredDialogProps) {
	return (
		<FeedbackDialog
			open={open}
			variant="info"
			icon={<LockOutlined />}
			title="Login Required"
			description="Please sign in to continue with this action and manage live aquarium orders."
			showCloseButton
			onClose={onClose}
			actions={[
				{
					label: "Sign In",
					onClick: onSignIn,
				},
				{
					label: "Cancel",
					variant: "secondary",
					onClick: onClose,
				},
			]}
		/>
	);
}

type RemoveItemDialogProps = DialogBaseProps & {
	onConfirm: () => void | Promise<void>;
};

export function RemoveItemDialog({
	open,
	onClose,
	onConfirm,
}: RemoveItemDialogProps) {
	async function handleConfirm() {
		await onConfirm();
		onClose();
	}

	return (
		<FeedbackDialog
			open={open}
			variant="error"
			icon={<DeleteOutlined />}
			title="Remove item?"
			description="Are you sure you want to remove this item from your cart?"
			showCloseButton
			onClose={onClose}
			actions={[
				{
					label: "Remove",
					variant: "danger",
					onClick: handleConfirm,
				},
				{
					label: "Keep Item",
					variant: "secondary",
					onClick: onClose,
				},
			]}
		/>
	);
}

type NetworkErrorDialogProps = DialogBaseProps & {
	onRetry?: () => void;
};

export function NetworkErrorDialog({
	open,
	onClose,
	onRetry,
}: NetworkErrorDialogProps) {
	return (
		<FeedbackDialog
			open={open}
			variant="warning"
			icon={<WarningOutlined />}
			title="Something went wrong"
			description="We couldn't complete your request. Please try again."
			showCloseButton
			onClose={onClose}
			actions={[
				{
					label: "Try Again",
					onClick: onRetry ?? onClose,
				},
			]}
		/>
	);
}
