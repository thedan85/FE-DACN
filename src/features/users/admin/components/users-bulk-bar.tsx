"use client";

import { Button, Typography } from "antd";

import styles from "./users-bulk-bar.module.css";

const { Text } = Typography;

type BulkAction = "lock" | "delete";

type UsersBulkBarProps = {
	count: number;
	/** The action currently running, or `null` when the bar is idle. */
	busy: BulkAction | null;
	canLock: boolean;
	canDelete: boolean;
	onLock: () => void;
	onDelete: () => void;
	onClear: () => void;
};

/**
 * The current page's selection and the actions that can run on it.
 *
 * It is deliberately not a floating overlay: the bar sits in the table's flow
 * so it cannot cover the rows it is about, and its `N selected` label keeps the
 * scope explicit — only the current page is selected, never the whole result
 * set.
 */
export function UsersBulkBar({
	count,
	busy,
	canLock,
	canDelete,
	onLock,
	onDelete,
	onClear,
}: UsersBulkBarProps) {
	return (
		<div className={styles.bar} role="region" aria-label="Bulk actions">
			<Text strong className={styles.count}>
				{count} selected
			</Text>

			<div className={styles.actions}>
				{canLock && (
					<Button
						onClick={onLock}
						loading={busy === "lock"}
						disabled={busy !== null}
					>
						Lock users
					</Button>
				)}
				{canDelete && (
					<Button
						danger
						onClick={onDelete}
						loading={busy === "delete"}
						disabled={busy !== null}
					>
						Delete selected
					</Button>
				)}
				<Button type="link" onClick={onClear} disabled={busy !== null}>
					Clear selection
				</Button>
			</div>
		</div>
	);
}
