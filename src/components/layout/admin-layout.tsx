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

/**
 * The breadcrumb tail for a path. Listed explicitly rather than derived from
 * the last URL segment: a product's edit route ends in `/edit`, which would
 * label the page "Edit", and the section name is what the design shows.
 */
const PAGE_TITLES: { href: string; title: string }[] = [
	{ href: "/admin/dashboard", title: "Dashboard" },
	{ href: "/admin/products", title: "Products & Variants" },
];

function currentPageTitle(pathname: string): string {
	const match = PAGE_TITLES.find(
		(entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`),
	);

	return match?.title ?? "Dashboard";
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
	const user = useAuthStore((state) => state.user);
	const pathname = usePathname();

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
					currentPage={currentPageTitle(pathname)}
					identity={{ name: user.name, roleName: user.roleName }}
				/>
				<main className={styles.main}>{children}</main>
			</div>
		</div>
	);
}
