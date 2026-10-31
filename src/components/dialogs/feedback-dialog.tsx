
"use client";

import {
	CheckCircleFilled,
	CloseCircleFilled,
	ExclamationCircleFilled,
	InfoCircleFilled,
} from "@ant-design/icons";
import { Button, Modal } from "antd";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import styles from "./feedback-dialog.module.css";

export type FeedbackDialogVariant =
	| "success"
	| "error"
	| "warning"
	| "info";

export type FeedbackDialogActionVariant =
	| "primary"
	| "secondary"
	| "danger";

export type FeedbackDialogAction = {
	label: string;
	onClick: () => void | Promise<void>;
	variant?: FeedbackDialogActionVariant;
	disabled?: boolean;
};

export type FeedbackDialogProps = {
	open: boolean;
	variant: FeedbackDialogVariant;
	title: string;
	description?: ReactNode;
	icon?: ReactNode;
	actions?: FeedbackDialogAction[];
	redirectUrl?: string;
	redirectText?: string;
	onClose: () => void;
	closeOnMaskClick?: boolean;
	closeOnEscape?: boolean;
	showCloseButton?: boolean;
	showEyebrow?: boolean;
};

const variantConfig = {
	success: {
		Icon: CheckCircleFilled,
		label: "Success",
	},
	error: {
		Icon: CloseCircleFilled,
		label: "Error",
	},
	warning: {
		Icon: ExclamationCircleFilled,
		label: "Warning",
	},
	info: {
		Icon: InfoCircleFilled,
		label: "Information",
	},
} satisfies Record<
	FeedbackDialogVariant,
	{ Icon: typeof CheckCircleFilled; label: string }
>;

export function FeedbackDialog({
	open,
	variant,
	title,
	description,
	icon,
	actions = [],
	redirectUrl,
	redirectText = "Continue",
	onClose,
	closeOnMaskClick = false,
	closeOnEscape = true,
	showCloseButton = false,
	showEyebrow = false,
}: FeedbackDialogProps) {
	const router = useRouter();

	const [loadingActionIndex, setLoadingActionIndex] = useState<
		number | null
	>(null);

	const { Icon, label } = variantConfig[variant];
	const isActionLoading = loadingActionIndex !== null;

	async function handleAction(
		action: FeedbackDialogAction,
		index: number,
	) {
		if (isActionLoading || action.disabled) return;

		setLoadingActionIndex(index);

		try {
			await action.onClick();
		} finally {
			setLoadingActionIndex(null);
		}
	}

	function handleRedirect() {
		if (isActionLoading || !redirectUrl) return;

		router.push(redirectUrl);
	}

	function getActionClassName(
		actionVariant: FeedbackDialogActionVariant,
	) {
		switch (actionVariant) {
			case "secondary":
				return styles.secondaryButton;
			case "danger":
				return styles.dangerButton;
			default:
				return styles.primaryButton;
		}
	}

	return (
		<Modal
			open={open}
			centered
			width={420}
			title={null}
			footer={null}
			closable={showCloseButton && !isActionLoading}
			onCancel={onClose}
			mask={{ closable: closeOnMaskClick }}
			keyboard={closeOnEscape && !isActionLoading}
			destroyOnHidden
			className={styles.modal}
		>
			<section
				className={styles.content}
				data-variant={variant}
				aria-labelledby="feedback-dialog-title"
				aria-describedby={
					description ? "feedback-dialog-description" : undefined
				}
			>
				<div className={styles.iconBadge} aria-hidden="true">
					{icon ? (
						<span className={styles.icon}>{icon}</span>
					) : (
						<Icon className={styles.icon} />
					)}
				</div>

				{showEyebrow && <p className={styles.eyebrow}>{label}</p>}

				<h2 id="feedback-dialog-title" className={styles.title}>
					{title}
				</h2>

				{description && (
					<div
						id="feedback-dialog-description"
						className={styles.description}
					>
						{description}
					</div>
				)}

				{(actions.length > 0 || redirectUrl) && (
					<div className={styles.actions}>
						{actions.map((action, index) => {
							const actionVariant = action.variant ?? "primary";

							return (
								<Button
									key={`${action.label}-${index}`}
									block
									className={getActionClassName(actionVariant)}
									disabled={
										action.disabled ||
										(isActionLoading && loadingActionIndex !== index)
									}
									loading={loadingActionIndex === index}
									onClick={() => void handleAction(action, index)}
								>
									{action.label}
								</Button>
							);
						})}

						{redirectUrl && (
							<Button
								block
								className={styles.primaryButton}
								disabled={isActionLoading}
								onClick={handleRedirect}
							>
								{redirectText}
							</Button>
						)}
					</div>
				)}
			</section>
		</Modal>
	);
}
