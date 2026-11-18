"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckOutlined, RightOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Skeleton, Tooltip } from "antd";
import { readinessNote } from "../model/readiness-copy";
import { useNotificationStore } from "../store";
import type { NotificationView } from "../types";
import styles from "./notification-preview.module.css";

export type NotificationPreviewProps = {
	mode: "customer" | "company";
	id?: string;
	onNavigate?: () => void;
};

function formatTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
	}).format(date);
}

function PreviewEntry({
	item,
	mode,
	onNavigate,
}: Pick<NotificationPreviewProps, "mode" | "onNavigate"> & { item: NotificationView }) {
	const markRead = useNotificationStore((state) => state.markRead);
	const [action, setAction] = useState<"idle" | "pending" | "error">("idle");
	const contentRef = useRef<HTMLDivElement>(null);
	const unread = item.status === "UNREAD";
	const time = item.occurredAt ?? item.createdAt;

	async function markAsRead(): Promise<void> {
		if (action === "pending") return;
		setAction("pending");
		try {
			await markRead(item.notificationId);
			setAction("idle");
		} catch {
			setAction("error");
		}
	}

	return (
		<li className={styles.entry} data-unread={unread}>
			<div className={styles.entryContent} ref={contentRef} tabIndex={-1}>
				{mode === "customer" && item.orderId ? (
					<Link
						href={`/account/orders/${encodeURIComponent(item.orderId)}`}
						className={styles.message}
						onNavigate={onNavigate}
					>
						{item.message}
					</Link>
				) : (
					<span className={styles.message}>{item.message}</span>
				)}
				<div className={styles.metadata}>
					<span className={styles.state}>{unread ? "Unread" : "Read"}</span>
					<time dateTime={time}>{formatTime(time)}</time>
				</div>
				{unread && action === "error" && (
					<p className={styles.actionError} role="alert">Could not mark as read. Try again.</p>
				)}
			</div>
			{unread && (
				<Tooltip title="Mark as read" trigger={["hover", "focus"]}>
					<Button
						color="primary"
						variant="filled"
						aria-label={`Mark “${item.message}” as read`}
						icon={<CheckOutlined className={styles.checkIcon} aria-hidden="true" />}
						loading={action === "pending"}
						onClick={(event) => {
							// Keep keyboard focus in the row when the action disappears.
							if (event.currentTarget === document.activeElement) contentRef.current?.focus();
							void markAsRead();
						}}
					/>
				</Tooltip>
			)}
		</li>
	);
}

export function NotificationPreview({ id, mode, onNavigate }: NotificationPreviewProps) {
	const preview = useNotificationStore((state) => state.preview);
	const unreadCount = useNotificationStore((state) => state.unreadCount);
	const loading = useNotificationStore((state) => state.previewLoading);
	const error = useNotificationStore((state) => state.previewError);
	const readiness = useNotificationStore((state) => state.readiness);
	const loadPreview = useNotificationStore((state) => state.loadPreview);

	let body: ReactNode;
	if (loading) {
		body = <Skeleton active paragraph={{ rows: 3 }} aria-label="Loading notifications" />;
	} else if (error) {
		body = (
			<Alert
				type="error"
				title="Could not load notifications."
				action={<Button size="small" onClick={() => { void loadPreview(); }}>Retry</Button>}
			/>
		);
	} else if (preview.length === 0) {
		body = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No notifications yet" />;
	} else {
		body = (
			<ul className={styles.list}>
				{preview.map((item) => (
					<PreviewEntry key={item.notificationId} item={item} mode={mode} onNavigate={onNavigate} />
				))}
			</ul>
		);
	}

	const note = readinessNote(readiness.status);
	const title = mode === "company" ? "Company notifications" : "Notifications";

	return (
		<div id={id} className={styles.root} role="dialog" aria-label={`${title} preview`} tabIndex={-1}>
			<div className={styles.heading}>
				<h2 className={styles.title}>{title}</h2>
				<span className={styles.count} role="status">{unreadCount} unread</span>
			</div>
			<div
				className={styles.body}
				role="region"
				aria-label="Recent notifications"
				aria-busy={loading}
				tabIndex={0}
			>
				{note ? <Alert type="info" title={note} className={styles.note} /> : null}
				{body}
			</div>
			<div className={styles.footer}>
				<Link
					className={styles.viewAll}
					href={mode === "company" ? "/admin/notifications" : "/account/notifications"}
					onNavigate={onNavigate}
				>
					View all notifications <RightOutlined aria-hidden="true" />
				</Link>
			</div>
		</div>
	);
}
