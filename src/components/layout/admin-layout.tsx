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

type PageCrumb = {
	title: string;
	/** Rendered between "Store admin" and the title when a design has three levels. */
	parent?: string;
};

/**
 * The breadcrumb tail for a path. Listed explicitly rather than derived from
 * the last URL segment: a product's edit route ends in `/edit`, which would
 * label the page "Edit", and the section name is what the design shows.
 *
 * The `/admin/users` routes are listed before the section itself so the
 * three-level pages win over the generic "User accounts" prefix match.
 */
const PAGE_TITLES: {
	matches: (pathname: string) => boolean;
	title: string;
	parent?: string;
}[] = [
	{ matches: (pathname) => pathname === "/admin/dashboard", title: "Dashboard" },
	{ matches: (pathname) => pathname === "/admin/roles/new", title: "Add role", parent: "Roles & permissions" },
	{ matches: (pathname) => /^\/admin\/roles\/[^/]+\/?$/.test(pathname), title: "Role detail", parent: "Roles & permissions" },
	{ matches: (pathname) => isAtOrBelow(pathname, "/admin/roles"), title: "Roles & permissions" },
	{
		matches: (pathname) => isAtOrBelow(pathname, "/admin/products"),
		title: "Products & Variants",
	},
	{
		matches: (pathname) => pathname === "/admin/users/new",
		title: "Add user",
		parent: "User accounts",
	},
	{
		matches: (pathname) => /^\/admin\/users\/[^/]+\/edit\/?$/.test(pathname),
		title: "Edit user",
		parent: "User accounts",
	},
	{
		matches: (pathname) => /^\/admin\/users\/[^/]+\/?$/.test(pathname),
		title: "User detail",
		parent: "User accounts",
	},
	{
		matches: (pathname) => isAtOrBelow(pathname, "/admin/users"),
		title: "User accounts",
	},
];

function isAtOrBelow(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

function currentPageCrumb(pathname: string): PageCrumb {
	const match = PAGE_TITLES.find((entry) => entry.matches(pathname));

	return match ?? { title: "Dashboard" };
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
	const crumb = currentPageCrumb(pathname);

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
					parentPage={crumb.parent}
					currentPage={crumb.title}
					identity={{ name: user.name, roleName: user.roleName }}
				/>
				<main className={styles.main}>{children}</main>
			</div>
		</div>
	);
}
