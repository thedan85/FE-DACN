"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin-sidebar.module.css";

type AdminSidebarProps = {
	collapsed: boolean;
	onToggleCollapse: () => void;
};

type NavItem = {
	label: string;
	icon: string;
	/** Present only for items that route; inert items render with no destination. */
	href?: string;
};

/** Static design data — the 11 nav items from the Figma admin design. */
const navItems: NavItem[] = [
	{
		label: "Dashboard",
		icon: "/images/admin/nav/layout-dashboard.svg",
		href: "/admin/dashboard",
	},
	{ label: "Orders", icon: "/images/admin/nav/shopping-bag.svg" },
	{ label: "Products & Variants", icon: "/images/admin/nav/fish.svg" },
	{ label: "Categories", icon: "/images/admin/nav/layers.svg" },
	{ label: "Inventory", icon: "/images/admin/nav/package.svg" },
	{ label: "Customers", icon: "/images/admin/nav/users.svg" },
	{ label: "Reviews", icon: "/images/admin/nav/message-square.svg" },
	{ label: "Promotions", icon: "/images/admin/nav/tag.svg" },
	{ label: "Analytics", icon: "/images/admin/nav/chart-no-axes-combined.svg" },
	{ label: "Staff & Permissions", icon: "/images/admin/nav/shield-check.svg" },
	{ label: "Settings", icon: "/images/admin/nav/settings.svg" },
];

export function AdminSidebar({ collapsed, onToggleCollapse }: AdminSidebarProps) {
	const pathname = usePathname();

	return (
		<aside
			id="admin-sidebar"
			className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
			aria-label="Admin sidebar"
		>
			<div className={styles.brand}>
				<p className={styles.brandName}>Aquarium Store</p>
				<p className={styles.brandLabel}>STORE ADMIN</p>
			</div>

			<nav className={styles.nav} aria-label="Admin sections">
				<ul className={styles.navList}>
					{navItems.map((item) => {
						const isActive = item.href !== undefined && pathname === item.href;
						const icon = (
							<Image
								src={item.icon}
								alt=""
								width={18}
								height={18}
								unoptimized
								className={styles.navIcon}
							/>
						);
						const label = <span className={styles.navLabel}>{item.label}</span>;

						return (
							<li key={item.label}>
								{item.href !== undefined ? (
									<Link
										href={item.href}
										className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
										aria-current={isActive ? "page" : undefined}
									>
										{icon}
										{label}
									</Link>
								) : (
									<span
										className={`${styles.navLink} ${styles.navLinkDisabled}`}
										aria-disabled="true"
									>
										{icon}
										{label}
									</span>
								)}
							</li>
						);
					})}
				</ul>
			</nav>

			<div className={styles.footer}>
				<Link href="/" className={styles.footerAction} aria-label="View storefront">
					<Image
						src="/images/admin/nav/external-link.svg"
						alt=""
						width={18}
						height={18}
						unoptimized
						className={styles.navIcon}
					/>
					<span className={styles.footerLabel}>View storefront</span>
				</Link>

				<span className={styles.footerDivider} aria-hidden="true" />

				<button
					type="button"
					className={styles.footerAction}
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					aria-controls="admin-sidebar"
					aria-expanded={!collapsed}
					onClick={onToggleCollapse}
				>
					<Image
						src="/images/admin/nav/panel-left-close.svg"
						alt=""
						width={18}
						height={18}
						unoptimized
						className={styles.navIcon}
					/>
					<span className={styles.footerLabel}>
						{collapsed ? "Expand sidebar" : "Collapse sidebar"}
					</span>
				</button>
			</div>
		</aside>
	);
}
