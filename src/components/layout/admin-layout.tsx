"use client";

import { useState } from "react";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";
import styles from "./admin-layout.module.css";

type AdminLayoutProps = {
	children: React.ReactNode;
};

/**
 * Admin portal shell: sidebar + header arranged around the main content area.
 * Collapse state is session-only (React state — intentionally not persisted).
 */
export function AdminLayout({ children }: AdminLayoutProps) {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	return (
		<div className={styles.shell}>
			<AdminSidebar
				collapsed={sidebarCollapsed}
				onToggleCollapse={() => setSidebarCollapsed((previous) => !previous)}
			/>

			<div className={styles.workspace}>
				<AdminHeader currentPage="Dashboard" />
				<main className={styles.main}>{children}</main>
			</div>
		</div>
	);
}
