"use client";

import { Form, Input } from "antd";
import { validateRoleName, validateRoleDescription } from "../model/role-form";

/** Shared by the two connected role forms, not a form instance of its own. */
export function RoleInformationFields({ disabled, nameBaseline }: { disabled: boolean; nameBaseline?: string | null }) {
	return <>
		<Form.Item name="name" label="Name" required extra="Up to 255 characters." rules={[{ validator: async (_, value: string | undefined) => {
			const error = validateRoleName(value ?? "", nameBaseline); if (error) throw new Error(error);
		} }]}>
			<Input disabled={disabled} />
		</Form.Item>
		<Form.Item name="description" label="Description" extra="Optional. Up to 2000 characters." rules={[{ validator: async (_, value: string | undefined) => {
			const error = validateRoleDescription(value ?? ""); if (error) throw new Error(error);
		} }]}>
			<Input.TextArea disabled={disabled} rows={3} placeholder="No description" />
		</Form.Item>
	</>;
}
