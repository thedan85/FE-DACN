"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Badge, Button, Popover } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useNotificationStore } from "../store";
import { NotificationPreview } from "./notification-preview";
import styles from "./notification-bell.module.css";

export type NotificationBellProps = {
	mode: "customer" | "company";
	className?: string;
};

/** One trigger per header; both read the shared count and open the same preview. */
export function NotificationBell({ mode, className }: NotificationBellProps) {
	const unreadCount = useNotificationStore((state) => state.unreadCount);
	const loadPreview = useNotificationStore((state) => state.loadPreview);
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const previewId = useId();

	const label = mode === "company" ? "Company notifications" : "Notifications";
	const accessibleName = unreadCount > 0
		? `${label}, ${unreadCount} unread`
		: `No unread ${label.toLowerCase()}`;

	function handleOpenChange(next: boolean): void {
		setOpen(next);
		// The store's single-flight guard dedupes a reopen while a request runs.
		if (next) void loadPreview();
	}

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setOpen(false);
			triggerRef.current?.focus();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open]);

	return (
		<Popover
			open={open}
			onOpenChange={handleOpenChange}
			trigger="click"
			placement="bottomRight"
			arrow={false}
			align={{ overflow: { shiftX: true, adjustY: 1 } }}
			styles={{ container: { padding: 0 } }}
			content={
				<NotificationPreview
					id={previewId}
					mode={mode}
					onNavigate={() => setOpen(false)}
				/>
			}
		>
			<span className={[styles.root, className].filter(Boolean).join(" ")}>
				<Button
					ref={triggerRef}
					type="text"
					className={styles.button}
					aria-label={accessibleName}
					aria-haspopup="dialog"
					aria-expanded={open}
					aria-controls={open ? previewId : undefined}
					onKeyDown={(event) => {
						if (!open || event.key !== "Tab" || event.shiftKey) return;
						const preview = document.getElementById(previewId);
						if (!preview) return;
						event.preventDefault();
						preview.focus();
					}}
					icon={
						<Badge count={unreadCount} overflowCount={99} size="small">
							<BellOutlined className={styles.icon} aria-hidden="true" />
						</Badge>
					}
				/>
			</span>
		</Popover>
	);
}
