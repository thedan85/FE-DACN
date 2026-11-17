"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Alert, Button, Empty, Skeleton } from "antd";
import { useNotificationStore } from "../store";
import type { NotificationView } from "../types";
import styles from "./notification-preview.module.css";

export type NotificationPreviewProps = {
	mode: "customer" | "company";
};

const CONNECTING_NOTE = "Connecting to live updates…";
const DEGRADED_NOTE = "Live updates are degraded; showing the latest saved notifications.";
const REST_ONLY_NOTE = "Live updates are unavailable; showing the latest saved notifications.";

function readinessNote(status: string): string | null {
	if (status === "live") return null;
	if (status === "connecting") return CONNECTING_NOTE;
	if (status === "degraded") return DEGRADED_NOTE;
	return REST_ONLY_NOTE;
}

function formatTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
	}).format(date);
}

export function NotificationPreview({ mode }: NotificationPreviewProps) {
	const preview = useNotificationStore((state) => state.preview);
	const loading = useNotificationStore((state) => state.previewLoading);
	const error = useNotificationStore((state) => state.previewError);
	const readiness = useNotificationStore((state) => state.readiness);
	const loadPreview = useNotificationStore((state) => state.loadPreview);

	let body: ReactNode;
	if (loading) {
		body = <Skeleton active paragraph={{ rows: 3 }} />;
	} else if (error) {
		body = (
			<Alert
				type="error"
				title="Could not load notifications."
				action={<Button size="small" onClick={() => { void loadPreview(); }}>Retry</Button>}
			/>
		);
	} else if (preview.length === 0) {
		body = <Empty description="No notifications yet" />;
	} else {
		body = (
			<ul className={styles.list}>
				{preview.map((item: NotificationView) => {
					const time = item.occurredAt ?? item.createdAt;
					return (
						<li key={item.notificationId} className={styles.entry}>
							{mode === "customer" && item.orderId ? (
								<Link href={`/account/orders/${item.orderId}`} className={styles.message}>
									{item.message}
								</Link>
							) : (
								<span className={styles.message}>{item.message}</span>
							)}
							<time className={styles.time} dateTime={time}>{formatTime(time)}</time>
						</li>
					);
				})}
			</ul>
		);
	}

	const note = readinessNote(readiness.status);
	const dialogLabel = mode === "company" ? "Company notifications preview" : "Notifications preview";

	return (
		<div className={styles.root} role="dialog" aria-label={dialogLabel}>
			{note ? <Alert type="info" title={note} className={styles.note} /> : null}
			{body}
		</div>
	);
}
