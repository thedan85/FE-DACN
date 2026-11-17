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

const REST_ONLY_NOTE = "Live updates are unavailable; showing the latest saved notifications.";

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

	return (
		<div className={styles.root}>
			{readiness.status !== "live" ? (
				<Alert type="info" title={REST_ONLY_NOTE} className={styles.note} />
			) : null}
			{body}
		</div>
	);
}
