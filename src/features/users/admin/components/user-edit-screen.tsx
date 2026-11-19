"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Result, Skeleton } from "antd";
import { AdminTheme } from "@/components/layout/admin-theme";
import { ErrorState } from "@/components/feedback/error-state";
import { getAdminUser } from "../api/users.api";
import { USER_PERMISSIONS } from "../model/permissions";
import { useUserApiFailure } from "../model/use-user-api-failure";
import type { UserDetail } from "../schema/user.schema";
import { useUserPermissions } from "../use-user-permissions";
import { UserEditForm } from "./user-edit-form";
import styles from "./user-edit-screen.module.css";

type EditState =
	| { status: "loading" }
	| { status: "not-found" }
	| { status: "forbidden" }
	| { status: "error"; message: string }
	| { status: "ready"; user: UserDetail; requestedUserId: string };

/** The loader never owns a form store that can outlive its mounted Form. */
export function UserEditScreen({ userId }: { userId: string }) {
	const { can } = useUserPermissions();
	const canEdit = can(USER_PERMISSIONS.read) && can(USER_PERMISSIONS.update);
	const handleFailure = useUserApiFailure();
	const [state, setState] = useState<EditState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		if (!canEdit) return;
		let active = true;
		getAdminUser(userId).then((user) => {
			if (active) setState({ status: "ready", user, requestedUserId: userId });
		}).catch((caught: unknown) => {
			if (!active) return;
			const failure = handleFailure(caught, "We couldn't load this user. Try again.");
			if (failure.kind === "not-found") setState({ status: "not-found" });
			else if (failure.kind === "forbidden") setState({ status: "forbidden" });
			else setState({ status: "error", message: failure.message });
		});
		return () => { active = false; };
	}, [userId, canEdit, reloadKey, handleFailure]);

	const retry = useCallback(() => {
		setState({ status: "loading" });
		setReloadKey((previous) => previous + 1);
	}, []);
	const back = <Button href="/admin/users">Back to user accounts</Button>;

	if (canEdit && state.status === "ready" && state.requestedUserId === userId) {
		return <UserEditForm key={state.user.userId} initialUser={state.user} />;
	}

	return (
		<AdminTheme>
			<section className={styles.page}>
				{!canEdit ? (
					<Result status="403" title="You can't edit users" subTitle="Editing users needs the user:read and user:update permissions. Ask an administrator to grant them to your role." extra={back} />
				) : state.status === "not-found" ? (
					<Result status="404" title="User not found" subTitle="This account may have been deleted, or the link is wrong." extra={back} />
				) : state.status === "forbidden" ? (
					<Result status="403" title="You don't have permission to edit this account" subTitle="The account exists, but your role cannot change it." extra={back} />
				) : state.status === "error" ? (
					<ErrorState title="We couldn't load this user" description={state.message} retryLabel="Try again" onRetry={retry} action={back} />
				) : (
					<div className={styles.skeleton} aria-busy="true" aria-live="polite">
						<span className={styles.srOnly}>Loading user…</span>
						<Skeleton active paragraph={{ rows: 8 }} />
					</div>
				)}
			</section>
		</AdminTheme>
	);
}
