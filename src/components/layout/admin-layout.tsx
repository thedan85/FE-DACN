"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";
import styles from "./admin-layout.module.css";

type AdminLayoutProps = {
	children: React.ReactNode;
};

const PAGE_LABELS: ReadonlyArray<[prefix: string, label: string]> = [
	["/admin/orders", "Orders"],
	["/admin/dashboard", "Dashboard"],
];

function pageLabel(pathname: string): string {
	return PAGE_LABELS.find(([prefix]) => pathname.startsWith(prefix))?.[1] ??
		"Admin";
}

/**
 * Admin portal shell: sidebar + header arranged around the main content area.
 * Collapse state is session-only (React state — intentionally not persisted).
 *
 * The guard admits this shell only after confirming a company account, so the
 * store always holds a user here and the header can take it as a required prop.
 */
export function AdminLayout({ children }: AdminLayoutProps) {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const pathname = usePathname();
	const user = useAuthStore((state) => state.user);

	// Unreachable through the guard; without it the shell has no identity to show.
	if (user === null) {
		return null;
	}

	return (
		<div className={styles.shell}>
			<AdminSidebar
				collapsed={sidebarCollapsed}
				onToggleCollapse={() => setSidebarCollapsed((previous) => !previous)}
			/>

			<div className={styles.workspace}>
				<AdminHeader
					currentPage={pageLabel(pathname)}
					identity={{ name: user.name, roleName: user.roleName }}
				/>
				<main className={styles.main}>{children}</main>
			</div>
		</div>
	);
}
