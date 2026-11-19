"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Card, Form, Input, Result, Typography } from "antd";
import { AdminTheme } from "@/components/layout/admin-theme";
import { useAdminApiFailure } from "@/hooks/use-admin-api-failure";
import { ApiError } from "@/lib/api/client";
import { createRole } from "../api/roles.api";
import { roleFormFailure } from "../model/role-api-error";
import { toCreateRoleInput, validateRoleCode, type RoleCreateValues } from "../model/role-form";
import { roleHref, ROLES_PATH } from "../model/role-format";
import { useRolePermissions } from "../use-role-permissions";
import { RoleInformationFields } from "./role-information-fields";
import styles from "./roles.module.css";

export function RoleCreateForm() {
	const { can } = useRolePermissions();
	return <AdminTheme>{can("role:create") ? <ConnectedRoleCreateForm /> : <Result status="403" title="You can't add roles" subTitle="Creating roles needs the role:create permission." extra={<Button href={ROLES_PATH}>Back to roles</Button>} />}</AdminTheme>;
}

/** Mounted only when access permits rendering the Form; never seeds an unbound store. */
function ConnectedRoleCreateForm() {
	const [form] = Form.useForm<RoleCreateValues>();
	const [saving, setSaving] = useState(false);
	const busy = useRef(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const { notification } = App.useApp();
	const handleFailure = useAdminApiFailure();

	async function save(values: RoleCreateValues) {
		if (busy.current) return;
		busy.current = true;
		setSaving(true);
		setError(null);
		try {
			const created = await createRole(toCreateRoleInput(values));
			notification.success({ title: "Role created. Now choose its permissions." });
			router.push(roleHref(created.roleId));
		} catch (caught) {
			if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) {
				const failure = roleFormFailure(caught, "create");
				form.setFields(failure.fields);
				setError(failure.alert);
			} else {
				const failure = handleFailure(caught, "We couldn't create this role. Try again.");
				if (failure.kind !== "session-expired") setError(failure.message);
			}
		} finally {
			busy.current = false;
			setSaving(false);
		}
	}

	return <section className={styles.page}>
		<header><Typography.Title level={1} className={styles.title}>Add role</Typography.Title><Typography.Text type="secondary">Create a custom role, then choose its permissions.</Typography.Text></header>
		{error && <Alert type="error" showIcon title="Couldn't create the role" description={error} />}
		<Form<RoleCreateValues> form={form} layout="vertical" initialValues={{ code: "", name: "", description: "" }} onFinish={(values) => void save(values)}>
			<Card title="Role information" className={styles.formCard}>
				<Form.Item name="code" label="Code" required extra="2–50 letters, digits and underscores. Stored in lowercase and cannot be changed later." rules={[{ validator: async (_, value: string | undefined) => { const error = validateRoleCode(value ?? ""); if (error) throw new Error(error); } }]}>
					<Input disabled={saving} autoComplete="off" />
				</Form.Item>
				<RoleInformationFields disabled={saving} />
			</Card>
			<footer className={styles.saveBar}>
				<Typography.Text type="secondary" className={styles.saveStatus}>New role · Not saved</Typography.Text>
				<Button href={ROLES_PATH} disabled={saving}>Cancel</Button>
				<Button type="primary" htmlType="submit" loading={saving}>Create role</Button>
			</footer>
		</Form>
	</section>;
}
