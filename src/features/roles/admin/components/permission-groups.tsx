"use client";

import { Button, Card, Checkbox, Empty, Typography } from "antd";
import { groupPermissions, effectiveSelection, toggleGroup } from "../model/permission-selection";
import type { Permission } from "../schema/role.schema";
import styles from "./roles.module.css";

type PermissionGroupsProps = {
	permissions: Permission[];
	selected: string[];
	locked: ReadonlySet<string>;
	disabled: boolean;
	onChange: (ids: string[]) => void;
};

export function PermissionGroups({ permissions, selected, locked, disabled, onChange }: PermissionGroupsProps) {
	if (permissions.length === 0) return <Empty description="No permissions are available." />;
	return <div className={styles.stack}>
		{groupPermissions(permissions).map((group) => {
			const ids = group.permissions.map((permission) => permission.permissionId);
			const count = ids.filter((id) => selected.includes(id)).length;
			return <Card key={group.resource} size="small" title={group.resource} extra={
				<Button type="link" size="small" disabled={disabled || ids.every((id) => locked.has(id))} aria-label={`${count === ids.length ? "Clear" : "Select all"} ${group.resource} permissions`} onClick={() => onChange(toggleGroup(selected, ids, locked))}>{count === ids.length ? "Clear" : "Select all"}</Button>
			}>
				<Typography.Paragraph type="secondary">{count} of {ids.length} selected</Typography.Paragraph>
				<div className={styles.permissionGrid}>
					{group.permissions.map((permission) => <Checkbox key={permission.permissionId}
						checked={selected.includes(permission.permissionId)}
						disabled={disabled || locked.has(permission.permissionId)}
						onChange={(event) => onChange(effectiveSelection(event.target.checked ? [...selected, permission.permissionId] : selected.filter((id) => id !== permission.permissionId), locked))}
					><span className={styles.permission}><span>{permission.name?.trim() || permission.code}</span><Typography.Text type="secondary" className={styles.mono}>{permission.code}</Typography.Text></span></Checkbox>)}
				</div>
			</Card>;
		})}
	</div>;
}
