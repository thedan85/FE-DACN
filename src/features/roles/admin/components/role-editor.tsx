"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Card, Form, Space, Typography } from "antd";
import { ApiError } from "@/lib/api/client";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { getMe } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/stores/auth-store";
import { useAdminApiFailure } from "@/hooks/use-admin-api-failure";
import { listPermissions, replaceRolePermissions, updateRole } from "../api/roles.api";
import { adminLockedIds, effectiveSelection, selectionDiff } from "../model/permission-selection";
import { isPermissionNotFound, roleFormFailure } from "../model/role-api-error";
import { roleInformationPatch, type RoleInformationValues } from "../model/role-form";
import { roleName, roleUsersHref, ROLES_PATH } from "../model/role-format";
import { useUnsavedRoleChanges } from "../model/use-unsaved-role-changes";
import type { Permission, RoleDetail } from "../schema/role.schema";
import { useRolePermissions } from "../use-role-permissions";
import { PermissionGroups } from "./permission-groups";
import { RoleBadge } from "./role-badge";
import { RoleInformationFields } from "./role-information-fields";
import { RoleDeleteDialog } from "./role-delete-dialog";
import styles from "./roles.module.css";

type RoleEditorProps = { initialRole: RoleDetail; initialPermissions: Permission[]; onNotFound: () => void };

/** Only mounted after both reads resolve: this component owns the connected Form. */
export function RoleEditor({ initialRole, initialPermissions, onNotFound }: RoleEditorProps) {
	const [form] = Form.useForm<RoleInformationValues>();
	const watched = Form.useWatch([], form) as Partial<RoleInformationValues> | undefined;
	const [role, setRole] = useState(initialRole);
	const [catalog, setCatalog] = useState(initialPermissions);
	const [selected, setSelected] = useState(() => initialRole.permissions.map((permission) => permission.permissionId));
	const [saving, setSaving] = useState(false);
	const [ownConfirmation, setOwnConfirmation] = useState<RoleInformationValues | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [authRefreshError, setAuthRefreshError] = useState<string | null>(null);
	const busy = useRef(false);
	const [formError, setFormError] = useState<string | null>(null);
	const { notification, message } = App.useApp();
	const handleFailure = useAdminApiFailure();
	const { can } = useRolePermissions();
	const signedInRoleCode = useAuthStore((state) => state.user?.roleCode);
	const ownRole = signedInRoleCode === role.code;
	const router = useRouter();
	const canUpdate = can("role:update");
	const customer = role.code === "customer";
	// The refreshed catalog is authoritative: do not resurrect an id removed
	// from it after a permission-not-found response just because the old detail had it.
	const locked = adminLockedIds(role, catalog);
	const baseline = role.permissions.map((permission) => permission.permissionId);
	const chosen = customer ? baseline : effectiveSelection(selected, locked);
	// Automatic locked grants are not an edit. Only an explicit toggle makes
	// grants dirty, so a metadata-only save cannot also replace permissions.
	const diff = selectionDiff(effectiveSelection(baseline, locked), chosen);
	const information = { name: watched?.name ?? role.name ?? "", description: watched?.description ?? role.description ?? "" };
	const patch = roleInformationPatch(role, information);
	const permissionsChanged = diff.added.length > 0 || diff.removed.length > 0;
	const dirty = Object.keys(patch).length > 0 || permissionsChanged;
	const controlsDisabled = saving || ownConfirmation !== null || authRefreshError !== null;
	useUnsavedRoleChanges(canUpdate && dirty && !saving);

	async function refreshOwnAccess() {
		try {
			const user = await getMe();
			useAuthStore.getState().setUser(user);
			setAuthRefreshError(null);
			if (!user.permissions.includes("role:read")) {
				message.info("You no longer have access to roles. Returning to the dashboard.");
				router.replace("/admin/dashboard");
			}
		} catch (caught) {
			const failure = handleFailure(caught, "We couldn't refresh your access. Reload before making more changes.");
			if (failure.kind !== "session-expired") setAuthRefreshError(`The role was saved, but your access could not be refreshed. ${failure.message}`);
		}
	}

	function requestSave(values: RoleInformationValues) {
		if (busy.current || ownConfirmation || !canUpdate || !dirty || authRefreshError) return;
		if (ownRole && permissionsChanged) setOwnConfirmation(values);
		else void save(values);
	}

	function reset() {
		form.setFieldsValue({ name: role.name ?? "", description: role.description ?? "" });
		setSelected(role.permissions.map((permission) => permission.permissionId));
		setFormError(null);
	}

	async function save(values: RoleInformationValues) {
		if (busy.current || !canUpdate || authRefreshError) return;
		const pending = roleInformationPatch(role, values);
		if (Object.keys(pending).length === 0 && !permissionsChanged) return;
		busy.current = true;
		setSaving(true);
		setFormError(null);
		const saved: string[] = [];
		let stage: "information" | "permissions" = "information";
		let latest = role;
		let sessionEnded = false;
		try {
			if (Object.keys(pending).length > 0) {
				latest = await updateRole(role.roleId, pending);
				setRole(latest);
				if (!permissionsChanged) {
					setSelected(latest.permissions.map((permission) => permission.permissionId));
				}
				saved.push("role information");
			}
			if (permissionsChanged && !customer) {
				stage = "permissions";
				latest = await replaceRolePermissions(role.roleId, chosen);
				setRole(latest);
				setSelected(latest.permissions.map((permission) => permission.permissionId));
				saved.push("permissions");
			}
			notification.success({ title: "Role updated successfully", description: `Saved ${saved.join(" and ")}.` });
		} catch (caught) {
			if (isPermissionNotFound(caught) && stage === "permissions") {
				try {
					const permissions = await listPermissions();
					const availableIds = new Set(permissions.map((permission) => permission.permissionId));
					setCatalog(permissions);
					// The complete catalog proves these grants no longer exist. Reconcile
					// both draft and baseline so Cancel cannot restore a deleted id.
					setRole((current) => ({ ...current, permissions: current.permissions.filter((permission) => availableIds.has(permission.permissionId)) }));
					setSelected((current) => current.filter((id) => availableIds.has(id)));
					message.info("The permission list changed. Review your selection and try again.");
				} catch (refreshError) {
					const failure = handleFailure(refreshError, "We couldn't refresh permissions. Reload and try again.");
					sessionEnded = failure.kind === "session-expired";
					if (failure.kind !== "session-expired") notification.error({ title: "Could not refresh permissions", description: failure.message });
				}
			} else {
				const failure = handleFailure(caught, "We couldn't save this role. Try again.");
				if (failure.kind === "session-expired") { sessionEnded = true; return; }
				if (failure.kind === "not-found") { onNotFound(); return; }
				if (stage === "information" && caught instanceof ApiError && caught.status === 400) {
					const result = roleFormFailure(caught, "update");
					form.setFields(result.fields.flatMap((field) => field.name === "code" ? [] : [{ name: field.name, errors: field.errors }]));
					setFormError(result.alert);
				}
				notification.error({ title: saved.length ? "Role partially updated" : "Could not update role", description: `${saved.length ? `Saved ${saved.join(" and ")}; permissions were not saved. ` : ""}${failure.message}` });
			}
			if (!sessionEnded && isPermissionNotFound(caught) && saved.length) notification.warning({ title: "Role partially updated", description: "Role information was saved; permissions were not saved." });
		} finally {
			// Even partial success may have changed our role's name/authority view.
			if (saved.length > 0 && ownRole && !sessionEnded) await refreshOwnAccess();
			busy.current = false;
			setSaving(false);
			setOwnConfirmation(null);
		}
	}

	return <>
		<Link href={ROLES_PATH}>Roles &amp; permissions</Link>
		<header className={styles.header}>
			<div><Typography.Title level={1} className={styles.title}>{roleName(role)}</Typography.Title><Space><Typography.Text className={styles.mono}>{role.code}</Typography.Text><RoleBadge system={role.system} /></Space></div>
			<Space wrap><Button href={roleUsersHref(role.code)}>View users with this role</Button>{!role.system && can("role:delete") && <Button danger disabled={controlsDisabled} onClick={() => setDeleteOpen(true)}>Delete role</Button>}</Space>
		</header>
		{formError && <Alert type="error" showIcon title="Couldn't save the role" description={formError} />}
		{authRefreshError && <Alert type="warning" title="Refresh your access before continuing" description={authRefreshError} action={<Button onClick={() => void refreshOwnAccess()}>Refresh access</Button>} />}
		<Form<RoleInformationValues> form={form} layout="vertical" initialValues={{ name: initialRole.name ?? "", description: initialRole.description ?? "" }} onFinish={requestSave}>
			<div className={styles.stack}>
				<Card title="Role information">
					<Typography.Paragraph><Typography.Text className={styles.mono}>{role.code}</Typography.Text><span className={styles.description}>Stored in lowercase and cannot be changed</span></Typography.Paragraph>
					<RoleInformationFields disabled={!canUpdate || controlsDisabled} nameBaseline={role.name} />
				</Card>
				<Card title="Permissions">
					{role.code === "admin" && <Typography.Paragraph type="secondary">The admin role must always keep user and role permissions</Typography.Paragraph>}
					{customer && <Typography.Paragraph type="secondary">This is the storefront role. Its permissions are read-only.</Typography.Paragraph>}
					<PermissionGroups permissions={catalog} selected={chosen} locked={locked} disabled={!canUpdate || controlsDisabled || customer} onChange={setSelected} />
				</Card>
			</div>
			{canUpdate && <footer className={styles.saveBar}>
				<Typography.Text type="secondary" className={styles.saveStatus} aria-live="polite">{saving ? "Saving…" : !dirty ? "No changes" : `+${diff.added.length} added, -${diff.removed.length} removed${Object.keys(patch).length ? " · Role information changed" : ""}`}</Typography.Text>
				<Button disabled={controlsDisabled || !dirty} onClick={reset}>Cancel</Button>
				<Button type="primary" htmlType="submit" loading={saving} disabled={!dirty || controlsDisabled}>Save changes</Button>
			</footer>}
		</Form>
		<ConfirmDialog open={ownConfirmation !== null} title="Change your own permissions?" description="You are changing your own permissions. This takes effect on your next request." confirmText="Save changes" cancelText="Keep editing" confirmLoading={saving} onCancel={() => { if (!busy.current) setOwnConfirmation(null); }} onConfirm={() => { if (ownConfirmation) return save(ownConfirmation); }} />
		<RoleDeleteDialog role={deleteOpen ? role : null} onClose={() => setDeleteOpen(false)} onDeleted={() => router.push(ROLES_PATH)} />
	</>;
}
