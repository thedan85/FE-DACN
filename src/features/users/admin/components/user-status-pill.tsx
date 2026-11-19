"use client";

import { Tag } from "antd";

import type { UserAccountStatus } from "../schema/user.schema";
import { userStatusLabel, userStatusTone } from "../model/user-status";
import styles from "./user-status-pill.module.css";

type UserStatusPillProps = {
	status: UserAccountStatus;
};

/**
 * The account status pill: a tinted background, a 4px dot, and a compact
 * label. The label is always rendered, so status is never colour alone.
 *
 * Built on antd's `Tag` so the semantics come from the library; the two design
 * colours come from the admin tokens through a scoped CSS module, because
 * `Tag` exposes no per-status tint token.
 */
export function UserStatusPill({ status }: UserStatusPillProps) {
	const tone = userStatusTone(status);

	return (
		<Tag
			className={`${styles.pill} ${styles[tone]}`}
			data-status={status}
			variant="filled"
		>
			<span className={styles.dot} aria-hidden="true" />
			{userStatusLabel(status)}
		</Tag>
	);
}
