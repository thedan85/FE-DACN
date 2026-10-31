"use client";

import { Modal } from "antd";
import type { ReactNode } from "react";
import styles from "./confirm-dialog.module.css";

type ConfirmDialogProps = {
	open: boolean;
	title: string;
	description?: ReactNode;
	confirmText?: string;
	cancelText?: string;
	confirmLoading?: boolean;
	onConfirm: () => void | Promise<void>;
	onCancel: () => void;
};

export function ConfirmDialog({
	open,
	title,
	description,
	confirmText = "Yes",
	cancelText = "No",
	confirmLoading = false,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	return (
		<Modal
			open={open}
			title={title}
			centered
			width={420}
			className={styles.modal}
			onCancel={onCancel}
			onOk={onConfirm}
			okText={confirmText}
			cancelText={cancelText}
			confirmLoading={confirmLoading}
			closable={!confirmLoading}
			mask={{ closable: false }}
			keyboard={!confirmLoading}
		>
			{description && (
				<div className={styles.description}>
					{description}
				</div>
			)}
		</Modal>
	);
}
