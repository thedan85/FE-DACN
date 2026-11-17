"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { CheckOutlined, DeleteOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Pagination, Radio, Skeleton, Spin } from "antd";
import { useAuthStore } from "@/stores/auth-store";
import { readinessNote } from "../model/readiness-copy";
import { useNotificationStore } from "../store";
import type { NotificationFilter, NotificationView } from "../types";
import styles from "./notification-inbox.module.css";

export type NotificationInboxProps = {
	mode: "customer" | "company";
};

const PAGE_SIZE = 20;

function formatTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
	}).format(date);
}

function InlineError({ title, onRetry }: { title: string; onRetry: () => void }) {
	return (
		<Alert
			type="error"
			title={title}
			className={styles.rowError}
			action={<Button size="small" onClick={onRetry}>Retry</Button>}
		/>
	);
}

/** One full inbox view for both routes; only links and labels differ by mode. */
export function NotificationInbox({ mode }: NotificationInboxProps) {
	const status = useAuthStore((state) => state.status);
	const user = useAuthStore((state) => state.user);
	const hydrate = useAuthStore((state) => state.hydrate);

	const unreadCount = useNotificationStore((state) => state.unreadCount);
	const list = useNotificationStore((state) => state.list);
	const page = useNotificationStore((state) => state.page);
	const size = useNotificationStore((state) => state.size);
	const filter = useNotificationStore((state) => state.filter);
	const totalElements = useNotificationStore((state) => state.totalElements);
	const listLoading = useNotificationStore((state) => state.listLoading);
	const listError = useNotificationStore((state) => state.listError);
	const readiness = useNotificationStore((state) => state.readiness);
	const loadList = useNotificationStore((state) => state.loadList);
	const setFilter = useNotificationStore((state) => state.setFilter);
	const markRead = useNotificationStore((state) => state.markRead);
	const deleteNotification = useNotificationStore((state) => state.deleteNotification);

	const accountKey = status === "authenticated" && user ? user.userId : null;
	/** Errors are keyed to the account, so a switch hides old-account state at once. */
	const [errorState, setErrorState] = useState<{
		account: string | null;
		errors: Record<string, string>;
	}>({ account: null, errors: {} });
	const rowErrors = errorState.account === accountKey ? errorState.errors : {};
	/** Per-row/action single flight, owned by the view and reset on account change. */
	const inFlight = useRef<Set<string>>(new Set());
	const initializedFor = useRef<string | null>(null);

	function clearError(key: string): void {
		setErrorState((current) => {
			const next = { ...(current.account === accountKey ? current.errors : {}) };
			delete next[key];
			return { account: accountKey, errors: next };
		});
	}

	function raiseError(key: string, title: string): void {
		setErrorState((current) => ({
			account: accountKey,
			errors: {
				...(current.account === accountKey ? current.errors : {}),
				[key]: title,
			},
		}));
	}

	useEffect(() => {
		if (status === "loading") void hydrate();
	}, [status, hydrate]);

	useEffect(() => {
		if (status !== "authenticated" || !user) {
			initializedFor.current = null;
			inFlight.current.clear();
			return;
		}
		if (initializedFor.current === user.userId) return;
		initializedFor.current = user.userId;
		inFlight.current.clear();
		void loadList({ page: 0, size: PAGE_SIZE, filter: "ALL" });
	}, [status, user, loadList]);

	function handleFilterChange(next: NotificationFilter): void {
		if (next === filter) return;
		setFilter(next);
		void loadList({ page: 0, size: PAGE_SIZE, filter: next });
	}

	function handlePageChange(nextPage: number): void {
		void loadList({ page: nextPage - 1, size, filter });
	}

	function retryList(): void {
		void loadList({ page, size, filter });
	}

	function deleteRow(item: NotificationView): void {
		const key = `delete:${item.notificationId}`;
		void runAction(key, async () => {
			await deleteNotification(item.notificationId);
			// The authoritative delete emptied the last row of a later page.
			// Walk back one page, never past the last page implied by the
			// committed total. Count/revision/total stay as the store left them.
			if (list.length === 1 && page > 0) {
				const lastPage = Math.max(0, Math.ceil(totalElements / size) - 1);
				void loadList({ page: Math.min(page - 1, lastPage), size, filter });
			}
		}, "Could not delete this notification.");
	}

	async function runAction(
		key: string,
		action: () => Promise<void>,
		failure: string,
	): Promise<void> {
		if (inFlight.current.has(key)) return;
		inFlight.current.add(key);
		clearError(key);
		try {
			await action();
		} catch {
			// The authoritative response never arrived: keep the row and count.
			raiseError(key, failure);
		} finally {
			inFlight.current.delete(key);
		}
	}

	function renderEntry(item: NotificationView): ReactNode {
		const time = item.occurredAt ?? item.createdAt;
		const readKey = `read:${item.notificationId}`;
		const deleteKey = `delete:${item.notificationId}`;
		const message = mode === "customer" && item.orderId ? (
			<Link
				href={`/account/orders/${encodeURIComponent(item.orderId)}`}
				className={styles.message}
			>
				{item.message}
			</Link>
		) : (
			<span className={styles.message}>{item.message}</span>
		);

		return (
			<li key={item.notificationId} className={styles.entry}>
				<div className={styles.entryMain}>
					{message}
					{mode === "company" && item.orderId ? (
						<span className={styles.fact}>Order <strong>{item.orderId}</strong></span>
					) : null}
					<time className={styles.time} dateTime={time}>{formatTime(time)}</time>
					<span className={styles.status}>
						{item.status === "READ" ? "Read" : "Unread"}
					</span>
				</div>
				<div className={styles.actions}>
					{item.status === "UNREAD" ? (
						<Button
							size="small"
							aria-label={`Mark notification ${item.notificationId} as read`}
							icon={<CheckOutlined aria-hidden="true" />}
							onClick={() => {
								void runAction(readKey, () => markRead(item.notificationId),
									"Could not mark this notification as read.");
							}}
						>
							Mark as read
						</Button>
					) : null}
					<Button
						size="small"
						danger
						aria-label={`Delete notification ${item.notificationId}`}
						icon={<DeleteOutlined aria-hidden="true" />}
						onClick={() => deleteRow(item)}
					>
						Delete
					</Button>
				</div>
				{rowErrors[readKey] ? (
					<InlineError
						title={rowErrors[readKey]}
						onRetry={() => {
							void runAction(readKey, () => markRead(item.notificationId),
								"Could not mark this notification as read.");
						}}
					/>
				) : null}
				{rowErrors[deleteKey] ? (
					<InlineError
						title={rowErrors[deleteKey]}
						onRetry={() => deleteRow(item)}
					/>
				) : null}
			</li>
		);
	}

	let body: ReactNode;
	if (status === "loading") {
		body = (
			<div className={styles.busy} aria-busy="true">
				<Spin size="large" />
			</div>
		);
	} else if (status === "anonymous" || !user) {
		body = (
			<section className={styles.guest} aria-labelledby="notifications-guest-title">
				<div className="page-container">
					<div className={styles.guestCard}>
						<span className={styles.guestIcon} aria-hidden="true">🔔</span>
						<h2 id="notifications-guest-title" className={styles.title}>Notifications</h2>
						<p>Sign in to view your notifications.</p>
						<Button type="primary" href="/login">Log In</Button>
					</div>
				</div>
			</section>
		);
	} else if (listLoading) {
		body = (
			<div aria-busy="true">
				<Skeleton active paragraph={{ rows: 4 }} />
			</div>
		);
	} else if (listError) {
		body = (
			<Alert
				type="error"
				title="Could not load notifications."
				action={<Button onClick={retryList}>Retry</Button>}
			/>
		);
	} else if (list.length === 0) {
		body = <Empty description="No notifications yet" />;
	} else {
		body = (
			<>
				<div className={styles.panel}>
					<ul className={styles.list}>{list.map(renderEntry)}</ul>
				</div>
				<Pagination
					className={styles.pagination}
					aria-label="Notification pages"
					current={page + 1}
					pageSize={size}
					total={totalElements}
					showSizeChanger={false}
					onChange={handlePageChange}
				/>
			</>
		);
	}

	const note = readinessNote(readiness.status);
	const title = mode === "company" ? "Company notifications" : "Notifications";
	const subtitle = mode === "company"
		? "Order and account events for your store."
		: "Updates about your orders and account.";

	return (
		<section className={styles.root} aria-labelledby="notifications-title">
			<div className={styles.shell}>
				<header className={styles.heading}>
					<h1 id="notifications-title" className={styles.title}>{title}</h1>
					<p className={styles.subtitle}>{subtitle}</p>
				</header>
				{status === "authenticated" && user ? (
					<>
						<div className={styles.controls}>
							<Radio.Group
								optionType="button"
								buttonStyle="solid"
								aria-label="Filter notifications"
								value={filter === "READ" ? "ALL" : filter}
								onChange={(event) => {
									handleFilterChange(event.target.value as NotificationFilter);
								}}
							>
								<Radio.Button value="ALL">All</Radio.Button>
								<Radio.Button value="UNREAD">Unread</Radio.Button>
							</Radio.Group>
							<span className={styles.count}>{unreadCount} unread</span>
						</div>
						{note ? <Alert type="info" title={note} className={styles.note} /> : null}
					</>
				) : null}
				{body}
			</div>
		</section>
	);
}
