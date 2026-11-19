"use client";

import { useEffect, useState } from "react";
import { Button, Result, Skeleton } from "antd";
import { AdminTheme } from "@/components/layout/admin-theme";
import { ErrorState } from "@/components/feedback/error-state";
import { useAdminApiFailure } from "@/hooks/use-admin-api-failure";
import { getRole, listPermissions } from "../api/roles.api";
import type { Permission, RoleDetail } from "../schema/role.schema";
import { useRolePermissions } from "../use-role-permissions";
import { ROLES_PATH } from "../model/role-format";
import { RoleEditor } from "./role-editor";
import styles from "./roles.module.css";

type DetailState = { status: "loading" } | { status: "error"; message: string } | { status: "not-found" } | { status: "forbidden" } | { status: "ready"; role: RoleDetail; permissions: Permission[]; roleId: string };

export function RoleDetailScreen({ roleId }: { roleId: string }) {
	const { can } = useRolePermissions();
	const canRead = can("role:read");
	const handleFailure = useAdminApiFailure();
	const [state, setState] = useState<DetailState>({ status: "loading" });
	const [reload, setReload] = useState(0);
	useEffect(() => {
		if (!canRead) return;
		setState({ status: "loading" });
		let active = true;
		Promise.all([getRole(roleId), listPermissions()]).then(([role, permissions]) => {
			if (active) setState({ status: "ready", role, permissions, roleId });
		}).catch((caught: unknown) => {
			if (!active) return;
			const failure = handleFailure(caught, "We couldn't load this role. Try again.");
			if (failure.kind === "not-found") setState({ status: "not-found" });
			else if (failure.kind === "forbidden") setState({ status: "forbidden" });
			else setState({ status: "error", message: failure.message });
		});
		return () => { active = false; };
	}, [roleId, canRead, reload, handleFailure]);
	// A save that started on an unmounted role must not replace what is on
	// screen now: a not-found answer only flips the view for the role the
	// editor it came from was actually showing.
	const handleNotFound = (editorRoleId: string) =>
		setState((current) =>
			current.status === "ready" && current.roleId === editorRoleId
				? { status: "not-found" }
				: current,
		);
	const back = <Button href={ROLES_PATH}>Back to roles</Button>;
	return <AdminTheme><section className={styles.page}>
		{!canRead ? <Result status="403" title="You don't have access to roles" extra={back} />
			: state.status === "not-found" ? <Result status="404" title="Role not found" subTitle="This role may have been deleted, or the link is wrong." extra={back} />
				: state.status === "forbidden" ? <Result status="403" title="You don't have permission to do this" extra={back} />
					: state.status === "error" ? <ErrorState description={state.message} action={back} onRetry={() => { setState({ status: "loading" }); setReload((value) => value + 1); }} />
						: state.status === "ready" && state.roleId === roleId ? <RoleEditor key={roleId} initialRole={state.role} initialPermissions={state.permissions} onNotFound={() => handleNotFound(state.roleId)} />
							: <div className={styles.skeleton} aria-busy="true" aria-label="Loading role"><Skeleton active paragraph={{ rows: 8 }} /></div>}
	</section></AdminTheme>;
}
