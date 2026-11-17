"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
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
	// Popover's click trigger toggles on a second trigger click. That must keep
	// the preview open; only outside clicks and Escape close it.
	const triggerClickRef = useRef(false);

	const label = mode === "company" ? "Company notifications" : "Notifications";
	const accessibleName = unreadCount > 0
		? `${label}, ${unreadCount} unread`
		: `No unread ${label.toLowerCase()}`;

	function openPreview(): void {
		setOpen(true);
		// The store's single-flight guard dedupes a reopen while a request runs.
		void loadPreview();
	}

	function handleTriggerClick(): void {
		triggerClickRef.current = true;
		openPreview();
	}

	function handleOpenChange(next: boolean): void {
		if (triggerClickRef.current) {
			triggerClickRef.current = false;
			return;
		}
		if (next) openPreview();
		else setOpen(false);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
		if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
			event.preventDefault();
			openPreview();
		}
	}

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape") return;
			triggerClickRef.current = false;
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
			content={<NotificationPreview mode={mode} />}
		>
			<span className={[styles.root, className].filter(Boolean).join(" ")}>
				<Button
					ref={triggerRef}
					type="text"
					className={styles.button}
					aria-label={accessibleName}
					aria-haspopup="dialog"
					aria-expanded={open}
					onClick={handleTriggerClick}
					onKeyDown={handleKeyDown}
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
