"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "antd";

import { ORDER_PERMISSIONS } from "@/features/orders/admin/model/order-permissions";
import { useAuthStore } from "@/stores/auth-store";

import styles from "./admin-sidebar.module.css";

type AdminSidebarProps = {
	collapsed: boolean;
	onToggleCollapse: () => void;
	/** Closes the mobile drawer when a destination is chosen. */
	onNavigate?: () => void;
	/** The drawer variant hides the collapse control and fills its panel. */
	inDrawer?: boolean;
};

type NavItem = {
	label: string;
	icon: string;
	/** Present only for items that route; inert items render with no destination. */
	href?: string;
	/** When set, the item renders only for accounts holding at least one of these permissions. */
	anyPermission?: readonly string[];
};

/** Staff and customer accounts share the `user:read` grant (see Admin User API). */
const USER_READ_PERMISSION = "user:read";
const ROLE_READ_PERMISSION = "role:read";

/** Static design data — the Figma admin design's nav items. */
const navItems: NavItem[] = [
	{
		label: "Dashboard",
		icon: "/images/admin/nav/layout-dashboard.svg",
		href: "/admin/dashboard",
	},
	{
		label: "Orders",
		icon: "/images/admin/nav/shopping-bag.svg",
		href: "/admin/orders",
		anyPermission: [ORDER_PERMISSIONS.read],
	},
	{
		label: "Products & Variants",
		icon: "/images/admin/nav/fish.svg",
		href: "/admin/products",
	},
	{
		label: "Categories",
		icon: "/images/admin/nav/layers.svg",
		href: "/admin/categories",
	},
	{
		label: "Attributes",
		icon: "/images/admin/nav/tag.svg",
		href: "/admin/attributes",
	},
	{
		label: "Media",
		icon: "/images/admin/nav/package.svg",
		href: "/admin/media",
	},
	{ label: "Inventory", icon: "/images/admin/nav/package.svg" },
	{
		label: "Customers",
		icon: "/images/admin/nav/users.svg",
		href: "/admin/customers",
		anyPermission: [USER_READ_PERMISSION],
	},
	{ label: "Reviews", icon: "/images/admin/nav/message-square.svg" },
	{ label: "Promotions", icon: "/images/admin/nav/tag.svg" },
	{ label: "Analytics", icon: "/images/admin/nav/chart-no-axes-combined.svg" },
	{
		label: "Staff & Permissions",
		icon: "/images/admin/nav/shield-check.svg",
		href: "/admin/roles",
		anyPermission: [ROLE_READ_PERMISSION],
	},
	{
		label: "User accounts",
		icon: "/images/admin/nav/user-cog.svg",
		href: "/admin/users",
		anyPermission: [USER_READ_PERMISSION],
	},
	{ label: "Settings", icon: "/images/admin/nav/settings.svg" },
];

/**
 * A section stays highlighted for everything beneath it, so
 * `/admin/products/[slug]/edit` still reads as "Products & Variants" rather
 * than falling back to nothing. Matching on `/admin` alone would light up every
 * item, so each href anchors on its own segment.
 */
function isActivePath(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({
	collapsed,
	onToggleCollapse,
	onNavigate,
	inDrawer = false,
}: AdminSidebarProps) {
	const pathname = usePathname();
	const permissions = useAuthStore((state) => state.user?.permissions);
	const visibleNavItems = navItems.filter(
		(item) =>
			item.anyPermission === undefined ||
			item.anyPermission.some((permission) =>
				permissions?.includes(permission),
			),
	);

	return (
		<aside
			id={inDrawer ? "admin-sidebar-drawer" : "admin-sidebar"}
			className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""} ${
				inDrawer ? styles.drawer : ""
			}`}
			aria-label="Admin sidebar"
		>
			<div className={styles.brand}>
				<p className={styles.brandName}>Aquarium Store</p>
				<p className={styles.brandLabel}>STORE ADMIN</p>
			</div>

			<nav className={styles.nav} aria-label="Admin sections">
				<ul className={styles.navList}>
					{visibleNavItems.map((item) => {
						const isActive =
							item.href !== undefined && isActivePath(pathname, item.href);
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
						// The collapsed rail hides the label span, so the name lives
						// on the link itself and survives icon-only rendering.
						const label = <span className={styles.navLabel}>{item.label}</span>;

						return (
							<li key={item.label}>
								{item.href !== undefined ? (
									<Link
										href={item.href}
										className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
										aria-current={isActive ? "page" : undefined}
										aria-label={item.label}
										onClick={onNavigate}
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
				<Link
					href="/"
					className={styles.footerAction}
					aria-label="View storefront"
					onClick={onNavigate}
				>
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

				{!inDrawer && (
					<>
						<span className={styles.footerDivider} aria-hidden="true" />

						<Button
							type="text"
							block
							className={styles.footerAction}
							icon={
								<Image
									src="/images/admin/nav/panel-left-close.svg"
									alt=""
									width={18}
									height={18}
									unoptimized
									className={styles.navIcon}
								/>
							}
							aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
							aria-controls="admin-sidebar"
							aria-expanded={!collapsed}
							onClick={onToggleCollapse}
						>
							<span className={styles.footerLabel}>
								{collapsed ? "Expand sidebar" : "Collapse sidebar"}
							</span>
						</Button>
					</>
				)}
			</div>
		</aside>
	);
}
