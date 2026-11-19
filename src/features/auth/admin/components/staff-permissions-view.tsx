"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "antd";

import { AdminCatalogTheme } from "@/features/products/admin/components/admin-catalog-theme";
import { AccessDeniedState } from "@/components/feedback/access-denied-state";
import { useAuthStore } from "@/stores/auth-store";

import { StaffDirectory } from "./staff-directory";
import { RolesPermissionsPanel } from "./roles-permissions-panel";
import styles from "./staff-directory.module.css";

const STAFF_TAB = "staff";
const ROLES_TAB = "roles";

/**
 * Staff & Permissions landing view: the staff directory and the roles
 * panel behind `tab=staff|roles`.
 *
 * The route gates on `user:read` or `role:read`; each tab additionally
 * requires its own permission, so a tab is only registered — and only
 * mounted — for an account that may see it. A disallowed or stale `tab`
 * value falls back to the first accessible tab. Anything the account may
 * not read never reaches the network.
 */
export function StaffPermissionsView() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const permissions = useAuthStore((state) => state.user?.permissions);
	const mayUserRead = permissions?.includes("user:read") === true;
	const mayRoleRead = permissions?.includes("role:read") === true;

	if (!mayUserRead && !mayRoleRead) {
		return (
			<AdminCatalogTheme>
				<AccessDeniedState
					title="You do not have access to staff or roles"
					description="Ask an administrator for the user:read or role:read permission."
				/>
			</AdminCatalogTheme>
		);
	}

	const requested = searchParams.get("tab");
	const active =
		requested === STAFF_TAB && mayUserRead
			? STAFF_TAB
			: requested === ROLES_TAB && mayRoleRead
				? ROLES_TAB
				: mayUserRead
					? STAFF_TAB
					: ROLES_TAB;

	const onChange = (key: string) => {
		const next = new URLSearchParams(searchParams.toString());
		next.set("tab", key);
		router.replace(`${pathname}?${next.toString()}`);
	};

	const items = [
		...(mayUserRead
			? [{ key: STAFF_TAB, label: "Staff", children: <StaffDirectory /> }]
			: []),
		...(mayRoleRead
			? [
					{
						key: ROLES_TAB,
						label: "Roles",
						children: <RolesPermissionsPanel />,
					},
				]
			: []),
	];

	return (
		<AdminCatalogTheme>
			<section className={styles.page}>
				<Tabs activeKey={active} onChange={onChange} items={items} />
			</section>
		</AdminCatalogTheme>
	);
}
