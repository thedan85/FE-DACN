"use client";

import { Tag } from "antd";
import type { ProductStatus } from "@/types";

import {
	productStatusLabel,
	productStatusTone,
} from "../model/product-status";
import styles from "./status-pill.module.css";

type StatusPillProps = {
	status: ProductStatus;
};

/**
 * The design's status pill: a tinted background, a 4px dot, and a compact label.
 *
 * Built on antd's `Tag` so the semantics and disabled/hover behaviour come from
 * the library, with the four design colours carried by a scoped CSS module —
 * `Tag` exposes no token for a per-status tint, which is the evidence for the
 * override (`docs/antd.md`).
 *
 * The label is always rendered, so status is never communicated by colour alone.
 */
export function StatusPill({ status }: StatusPillProps) {
	const tone = productStatusTone(status);

	return (
		<Tag
			className={`${styles.pill} ${styles[tone]}`}
			data-status={status}
			variant="filled"
		>
			<span className={styles.dot} aria-hidden="true" />
			{productStatusLabel(status)}
		</Tag>
	);
}
