"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Result, Skeleton, Space, Table, Tooltip, Typography } from "antd";
import type { TableColumnsType } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { AdminTheme } from "@/components/layout/admin-theme";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { useAdminApiFailure } from "@/hooks/use-admin-api-failure";
import { formatAdminDate } from "@/lib/utils/admin-date";
import { listRoles } from "../api/roles.api";
import { roleHref, roleName, roleUsersHref, ROLES_PATH } from "../model/role-format";
import type { RoleSummary } from "../schema/role.schema";
import { useRolePermissions } from "../use-role-permissions";
import { RoleBadge } from "./role-badge";
import { RoleDeleteDialog } from "./role-delete-dialog";
import styles from "./roles.module.css";

type ListState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; roles: RoleSummary[] };

export function RolesListing() {
	const router = useRouter();
	const { can } = useRolePermissions();
	const canRead = can("role:read");
	const handleFailure = useAdminApiFailure();
	const [state, setState] = useState<ListState>({ status: "loading" });
	const [reload, setReload] = useState(0);
	const [search, setSearch] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<RoleSummary | null>(null);
	useEffect(() => {
		if (!canRead) return;
		let active = true;
		listRoles().then((roles) => { if (active) setState({ status: "ready", roles }); }).catch((caught: unknown) => {
			if (active) setState({ status: "error", message: handleFailure(caught, "We couldn't load roles. Try again.").message });
		});
		return () => { active = false; };
	}, [canRead, reload, handleFailure]);
	const retry = () => { setState({ status: "loading" }); setReload((value) => value + 1); };
	const roles = state.status === "ready" ? state.roles : [];
	const keyword = search.trim().toLowerCase();
	// Filtering preserves server order; this endpoint is not paginated.
	const rows = roles.filter((role) => `${role.name ?? ""} ${role.code}`.toLowerCase().includes(keyword));
	const columns: TableColumnsType<RoleSummary> = [
		{ title: "Role", key: "name", render: (_, role) => <><Link href={roleHref(role.roleId)}>{roleName(role)}</Link><span className={styles.description}>{role.description?.trim() || "No description"}</span></> },
		{ title: "Code", key: "code", render: (_, role) => <span className={styles.mono}>{role.code}</span> },
		{ title: "Type", key: "system", render: (_, role) => <RoleBadge system={role.system} /> },
		{ title: "Updated", key: "updatedAt", responsive: ["md"], render: (_, role) => formatAdminDate(role.updatedAt) },
		{ title: "Actions", key: "actions", align: "right", render: (_, role) => <Space onClick={(event) => event.stopPropagation()} wrap>
			<Button type="link" href={roleHref(role.roleId)}>View</Button>
			<Button type="link" href={roleUsersHref(role.code)}>View users</Button>
			{can("role:delete") && role.system && <Tooltip title="System roles cannot be deleted"><span><Button type="link" danger disabled aria-label={`Delete ${roleName(role)}`}>Delete</Button></span></Tooltip>}
			{can("role:delete") && !role.system && <Button type="link" danger aria-label={`Delete ${roleName(role)}`} onClick={() => setDeleteTarget(role)}>Delete</Button>}
		</Space> },
	];
	return <AdminTheme><section className={styles.page}>
		<header className={styles.header}><div><Typography.Title level={1} className={styles.title}>Roles &amp; permissions</Typography.Title><Typography.Text type="secondary">Manage company roles and their permissions.</Typography.Text></div>{can("role:create") && <Button type="primary" href={`${ROLES_PATH}/new`}>Add role</Button>}</header>
		{!canRead ? <Result status="403" title="You don't have access to roles" subTitle="Viewing roles needs the role:read permission." /> : <Card styles={{ body: { padding: 0 } }}>
			<div className={styles.toolbar}><Input aria-label="Search roles" placeholder="Search by name or code…" prefix={<SearchOutlined />} value={search} allowClear onChange={(event) => setSearch(event.target.value)} /></div>
			{state.status === "loading" ? <div className={styles.skeleton} aria-label="Loading roles" aria-busy="true"><Skeleton active paragraph={{ rows: 5 }} /></div> : state.status === "error" ? <ErrorState title="We couldn't load roles" description={state.message} onRetry={retry} /> : rows.length === 0 ? <EmptyState title="No roles found" description={keyword ? "Try another search." : "No roles are available."} action={keyword ? <Button onClick={() => setSearch("")}>Clear search</Button> : undefined} /> : <>
				<Table<RoleSummary> rowKey="roleId" dataSource={rows} columns={columns} pagination={false} scroll={{ x: 640 }} onRow={(role) => ({ onClick: (event) => { if (!(event.target instanceof Element) || !event.target.closest("a,button")) router.push(roleHref(role.roleId)); } })} />
				<footer className={styles.footer}><Typography.Text type="secondary" aria-live="polite">Showing {rows.length} of {roles.length} roles</Typography.Text></footer>
			</>}
		</Card>}
		<RoleDeleteDialog role={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={retry} />
	</section></AdminTheme>;
}
