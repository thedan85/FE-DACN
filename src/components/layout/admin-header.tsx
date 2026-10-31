"use client";

import Image from "next/image";
import { Input } from "antd";
import { getInitials } from "@/lib/utils/initials";
import styles from "./admin-header.module.css";

export type AdminHeaderIdentity = {
	name: string;
	roleName: string;
};

type AdminHeaderProps = {
	/** Breadcrumb tail — the page currently shown in the shell. */
	currentPage: string;
	/** Signed-in identity once resolved; renders a loading placeholder while absent. */
	identity?: AdminHeaderIdentity | null;
};

export function AdminHeader({ currentPage, identity }: AdminHeaderProps) {
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

				<div
					className={styles.identity}
					aria-busy={identity ? undefined : true}
				>
					<span className={styles.avatar} aria-hidden="true">
						{identity ? getInitials(identity.name) : null}
					</span>
					<span className={styles.identityDetails}>
						{identity ? (
							<>
								<span className={styles.identityName}>{identity.name}</span>
								<span className={styles.identityRole}>{identity.roleName}</span>
							</>
						) : (
							<>
								<span
									className={`${styles.skeleton} ${styles.skeletonName}`}
									aria-hidden="true"
								/>
								<span
									className={`${styles.skeleton} ${styles.skeletonRole}`}
									aria-hidden="true"
								/>
								<span className={styles.visuallyHidden}>
									Loading account details
								</span>
							</>
						)}
					</span>
				</div>
			</div>
		</header>
	);
}
