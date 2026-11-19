"use client";

import { useRef, useState } from "react";
import { App } from "antd";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { useAdminApiFailure } from "@/hooks/use-admin-api-failure";
import { ApiError } from "@/lib/api/client";
import { deleteRole } from "../api/roles.api";
import { roleName } from "../model/role-format";
import type { RoleSummary } from "../schema/role.schema";
import { useRolePermissions } from "../use-role-permissions";

type RoleDeleteDialogProps = { role: RoleSummary | null; onClose: () => void; onDeleted: () => void };

export function RoleDeleteDialog({ role, onClose, onDeleted }: RoleDeleteDialogProps) {
	const { can } = useRolePermissions();
	const { notification } = App.useApp();
	const handleFailure = useAdminApiFailure();
	const [deleting, setDeleting] = useState(false);
	const busy = useRef(false);
	if (!role || role.system || !can("role:delete")) return null;

	async function confirmDelete() {
		if (!role || role.system || busy.current || !can("role:delete")) return;
		busy.current = true;
		setDeleting(true);
		try {
			await deleteRole(role.roleId);
			notification.success({ title: "Role deleted", description: `${roleName(role)} is no longer available for assignment.` });
			onDeleted();
			onClose();
		} catch (caught) {
			const failure = handleFailure(caught, "We couldn't delete this role. Try again.");
			if (failure.kind !== "session-expired") notification.error({ title: "Could not delete role", description: failure.message });
			if (caught instanceof ApiError && caught.status === 404) { onDeleted(); onClose(); }
		} finally {
			busy.current = false;
			setDeleting(false);
		}
	}
	return <ConfirmDialog open title="Delete role?" danger confirmText="Delete role" cancelText="Keep role" confirmLoading={deleting}
		onConfirm={confirmDelete} onCancel={() => { if (!busy.current) onClose(); }}
		description={<><p><strong>{roleName(role)}</strong></p><p>This is a soft delete. The role disappears from the list and user assignment. Its code cannot be reused later.</p></>}
	/>;
}
