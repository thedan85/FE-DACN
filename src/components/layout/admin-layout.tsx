"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Drawer } from "antd";
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
	{ href: "/admin/orders", title: "Orders" },
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
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const user = useAuthStore((state) => state.user);
	const pathname = usePathname();

	useEffect(() => {
		closeMobileNav();
	}, [pathname]);

	useEffect(() => {
		const desktop = window.matchMedia("(min-width: 901px)");
		const handleDesktop = (event: MediaQueryListEvent) => {
			if (event.matches) {
				setMobileNavOpen(false);
			}
		};

		desktop.addEventListener("change", handleDesktop);
		return () => desktop.removeEventListener("change", handleDesktop);
	}, []);

	// Unreachable through the guard; without it the shell has no identity to show.
	if (user === null) {
		return null;
	}

	function closeMobileNav() {
		setMobileNavOpen(false);
	}

	return (
		<div className={styles.shell}>
			<div className={styles.sidebarSlot}>
				<AdminSidebar
					collapsed={sidebarCollapsed}
					onToggleCollapse={() => setSidebarCollapsed((previous) => !previous)}
				/>
			</div>

			<div className={styles.workspace}>
				<AdminHeader
					currentPage={currentPageTitle(pathname)}
					identity={{ name: user.name, roleName: user.roleName }}
					onOpenNav={() => setMobileNavOpen(true)}
				/>
				<main className={styles.main}>{children}</main>
			</div>

			<Drawer
				open={mobileNavOpen}
				onClose={closeMobileNav}
				placement="left"
				size={264}
				closable={false}
				classNames={{ body: styles.drawerBody }}
			>
				<AdminSidebar
					collapsed={false}
					inDrawer
					onToggleCollapse={closeMobileNav}
					onNavigate={closeMobileNav}
				/>
			</Drawer>
		</div>
	);
}
