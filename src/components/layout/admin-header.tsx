"use client";

import { useState } from "react";
import Image from "next/image";
import { App, Dropdown, Input } from "antd";
import type { MenuProps } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { getInitials } from "@/lib/utils/initials";
import { useAuthStore } from "@/stores/auth-store";
import styles from "./admin-header.module.css";

export type AdminHeaderIdentity = {
	name: string;
	roleName: string;
};

type AdminHeaderProps = {
	/** Breadcrumb tail — the page currently shown in the shell. */
	currentPage: string;
	/** Signed-in identity. The guard resolves the session before the shell mounts. */
	identity: AdminHeaderIdentity;
};

export function AdminHeader({ currentPage, identity }: AdminHeaderProps) {
	const { message } = App.useApp();
	const signOut = useAuthStore((state) => state.signOut);
	const [menuOpen, setMenuOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);

	async function handleSignOut() {
		if (signingOut) {
			return;
		}

		setSigningOut(true);

		try {
			// Ending the session is all this does: the portal guard watches the
			// store and returns to /admin/login, so the destination lives in one
			// place instead of being repeated here.
			await signOut();
		} catch {
			message.error("Could not log out. Please try again.");
			setSigningOut(false);
		}
	}

	const accountMenu: MenuProps = {
		items: [
			{
				key: "logout",
				label: signingOut ? "Logging out…" : "Log out",
				icon: <LogoutOutlined />,
				disabled: signingOut,
			},
		],
		onClick: ({ key }) => {
			if (key === "logout") {
				void handleSignOut();
			}
		},
	};

	return (
		<header className={styles.header}>
			<div className={styles.bar}>
				<nav className={styles.breadcrumb} aria-label="Breadcrumb">
					<span className={styles.breadcrumbParent}>Store admin</span>
					<Image
						src="/images/admin/header/chevron-right.svg"
						alt=""
						width={13}
						height={13}
						unoptimized
						className={styles.breadcrumbSeparator}
					/>
					<span className={styles.breadcrumbCurrent} aria-current="page">
						{currentPage}
					</span>
				</nav>

				<Input
					className={styles.search}
					prefix={
						<Image
							src="/images/admin/header/search.svg"
							alt=""
							width={16}
							height={16}
							unoptimized
						/>
					}
					placeholder="Search anything…"
					aria-label="Search anything"
				/>

				{/* Presentational until notifications exist — deliberately not a button. */}
				<Image
					src="/images/admin/header/notifications.svg"
					alt=""
					width={28}
					height={30}
					unoptimized
					className={styles.bell}
					aria-hidden="true"
				/>

				<span className={styles.divider} aria-hidden="true" />

				<Dropdown
					menu={accountMenu}
					open={menuOpen}
					onOpenChange={setMenuOpen}
					placement="bottomRight"
					trigger={["click"]}
				>
					{/* A raw button rather than an antd Button: antd's token path covers
					    Button's own padding, height and weight, but this slot is the
					    design's avatar + name + role + chevron block — a multi-line
					    layout Button's single-line label cannot host, so overriding it
					    would rebuild the component. Dropdown also needs one focusable
					    child to attach the menu to, which this carries. */}
					<button
						type="button"
						className={styles.identityTrigger}
						aria-haspopup="menu"
						aria-expanded={menuOpen}
					>
						<span className={styles.avatar} aria-hidden="true">
							{getInitials(identity.name)}
						</span>
						<span className={styles.identityDetails}>
							<span className={styles.identityName}>{identity.name}</span>
							<span className={styles.identityRole}>{identity.roleName}</span>
						</span>
						<Image
							src="/images/admin/header/chevron-down.svg"
							alt=""
							width={13}
							height={13}
							unoptimized
							className={styles.identityChevron}
						/>
					</button>
				</Dropdown>
			</div>
		</header>
	);
}
