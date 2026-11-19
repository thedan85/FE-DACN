"use client";

import { Tag } from "antd";
import styles from "./roles.module.css";

/** Tag's per-kind surface tint is supplied by the existing admin colour tokens. */
export function RoleBadge({ system }: { system: boolean }) {
	return <Tag variant="filled" className={`${styles.badge} ${system ? styles.system : styles.custom}`}>{system ? "System" : "Custom"}</Tag>;
}
