"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
	Alert,
	App,
	Button,
	Card,
	Checkbox,
	Divider,
	Form,
	Input,
	Modal,
	Tag,
	Typography,
} from "antd";

import { AdminCatalogTheme } from "@/features/products/admin/components/admin-catalog-theme";
import { apiErrorMessage } from "@/features/products/admin/model/api-error";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { AccessDeniedState } from "@/components/feedback/access-denied-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useAuthStore } from "@/stores/auth-store";

import {
	createAdminRole,
	deleteAdminRole,
	getAdminRole,
	listAdminPermissions,
	listAdminRoles,
	patchAdminRole,
	replaceAdminRolePermissions,
} from "../api/admin-roles.api";
import { handleAdminAuthFailure } from "../model/admin-auth-failure";
import type {
	AdminPermission,
	AdminRoleDetail,
	AdminRoleSummary,
} from "../schema/admin-roles.schema";
import styles from "./roles-permissions-panel.module.css";

const { Title, Text } = Typography;

/**
 * Roles & Permissions admin view.
 *
 * Reads are gated on `role:read` before any request fires; writes gate on
 * their own permissions and are still handled for 401/403 server-side via
 * `handleAdminAuthFailure`. Grants are edited against the whole permission
 * set the backend replaces — the sender convention is unique IDs — and the
 * admin role's user/role grants are locked because the server would answer
 * `409` otherwise. The customer role is read-only here: it manages
 * storefront accounts and is never editable from this screen.
 *
 * After a grant change the edited role comes from the `PUT` response, and the
 * actor's session is revalidated because permissions apply on the next
 * request. A conflict keeps the draft in place and surfaces the server
 * message instead of resetting the form.
 */

type ListState =
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string }
	| { status: "ready" };

type DetailState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string }
	| { status: "ready"; detail: AdminRoleDetail };

function isAdminRole(role: Pick<AdminRoleSummary, "system" | "code">): boolean {
	return role.system === true && role.code.toLowerCase() === "admin";
}

function isCustomerRole(role: Pick<AdminRoleSummary, "code">): boolean {
	return role.code.toLowerCase() === "customer";
}

function isAdminProtectedPermission(permission: AdminPermission): boolean {
	const resource = permission.resource.toLowerCase();
	return resource === "user" || resource === "role";
}

export function RolesPermissionsPanel() {
	const router = useRouter();
	// The App-hook form sees the ConfigProvider theme; static message cannot.
	const { message } = App.useApp();
	const permissions = useAuthStore((state) => state.user?.permissions);
	const mayRoleRead = permissions?.includes("role:read") === true;
	const mayCreate = permissions?.includes("role:create") === true;
	const mayUpdate = permissions?.includes("role:update") === true;
	const mayDelete = permissions?.includes("role:delete") === true;

	const [listState, setListState] = useState<ListState>({
		status: "loading",
	});
	const [roles, setRoles] = useState<AdminRoleSummary[]>([]);
	const [catalog, setCatalog] = useState<AdminPermission[]>([]);
	const [listReloadKey, setListReloadKey] = useState(0);
	const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
	const [detailState, setDetailState] = useState<DetailState>({
		status: "idle",
	});
	const [detailReloadKey, setDetailReloadKey] = useState(0);
	const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
	const [grantsConfirmOpen, setGrantsConfirmOpen] = useState(false);
	const [grantsSaving, setGrantsSaving] = useState(false);
	const [grantsError, setGrantsError] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [metaSaving, setMetaSaving] = useState(false);
	const [metaError, setMetaError] = useState<string | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<AdminRoleSummary | null>(
		null,
	);
	const [deleting, setDeleting] = useState(false);

	const initializedFor = useRef<string | null>(null);

	useEffect(() => {
		if (!mayRoleRead) {
			return;
		}

		let active = true;
		setListState({ status: "loading" });

		Promise.all([listAdminRoles(), listAdminPermissions()])
			.then(([roleRows, permissionRows]) => {
				if (!active) {
					return;
				}

				setRoles(roleRows);
				setCatalog(permissionRows);
				setListState({ status: "ready" });
				// Keep the current selection when it survived the refresh,
				// otherwise land on the first role in the list.
				setSelectedRoleId((previous) =>
					previous && roleRows.some((role) => role.roleId === previous)
						? previous
						: (roleRows[0]?.roleId ?? null),
				);
			})
			.catch(async (caught: unknown) => {
				if (!active) {
					return;
				}

				const outcome = await handleAdminAuthFailure(caught, router);
				if (!active) {
					return;
				}

				if (outcome === "unhandled") {
					setListState({
						status: "error",
						message: apiErrorMessage(
							caught,
							"Could not load roles. Check your connection and try again.",
						),
					});
					return;
				}

				setListState({ status: "forbidden" });
			});

		return () => {
			active = false;
		};
	}, [mayRoleRead, listReloadKey, router]);

	useEffect(() => {
		if (!selectedRoleId) {
			setDetailState({ status: "idle" });
			return;
		}

		let active = true;
		setDetailState({ status: "loading" });

		getAdminRole(selectedRoleId)
			.then((detail) => {
				if (!active) {
					return;
				}

				setDetailState({ status: "ready", detail });
				setChecked(
					new Set(detail.permissions.map((grant) => grant.permissionId)),
				);
				setGrantsError(null);
			})
			.catch(async (caught: unknown) => {
				if (!active) {
					return;
				}

				const outcome = await handleAdminAuthFailure(caught, router);
				if (!active) {
					return;
				}

				if (outcome === "unhandled") {
					setDetailState({
						status: "error",
						message: apiErrorMessage(
							caught,
							"Could not load this role. Check your connection and try again.",
						),
					});
					return;
				}

				setDetailState({ status: "forbidden" });
			});

		return () => {
			active = false;
		};
	}, [selectedRoleId, detailReloadKey, router]);

	// Seed the metadata draft once per role. A same-role refresh (for example
	// after a grant save) must not clobber what the user is typing.
	useEffect(() => {
		if (detailState.status !== "ready") {
			return;
		}

		const roleId = detailState.detail.roleId;
		if (initializedFor.current === roleId) {
			return;
		}

		initializedFor.current = roleId;
		setName(detailState.detail.name);
		setDescription(detailState.detail.description ?? "");
		setMetaError(null);
	}, [detailState]);

	const detail = detailState.status === "ready" ? detailState.detail : null;

	// The catalog is static per mount; groups keep the DOM order stable.
	const grantGroups = useMemo(() => {
		const byResource = new Map<string, AdminPermission[]>();

		for (const permission of catalog) {
			const key = permission.resource.trim().toLowerCase() || "other";
			const group = byResource.get(key);

			if (group) {
				group.push(permission);
			} else {
				byResource.set(key, [permission]);
			}
		}

		return [...byResource.entries()]
			.map(([resource, items]) => ({
				resource,
				items: [...items].sort((left, right) =>
					left.code.localeCompare(right.code),
				),
			}))
			.sort((left, right) => left.resource.localeCompare(right.resource));
	}, [catalog]);

	const lockedPermissionIds = useMemo(() => {
		if (!detail || !isAdminRole(detail)) {
			return new Set<string>();
		}

		return new Set(
			catalog
				.filter(isAdminProtectedPermission)
				.map((permission) => permission.permissionId),
		);
	}, [catalog, detail]);

	const grantedIds = useMemo(
		() =>
			new Set(detail?.permissions.map((grant) => grant.permissionId) ?? []),
		[detail],
	);

	const grantsDirty = detail
		? checked.size !== grantedIds.size ||
			[...checked].some((id) => !grantedIds.has(id))
		: false;

	const customerRoleSelected = detail ? isCustomerRole(detail) : false;
	const editable = mayUpdate && !customerRoleSelected;
	const metadataDirty =
		detail !== null &&
		(name.trim() !== detail.name ||
			description.trim() !== (detail.description ?? ""));
	const metadataValid = name.trim() !== "";

	const toggleGrant = (permissionId: string) => {
		if (lockedPermissionIds.has(permissionId)) {
			return;
		}

		setGrantsError(null);
		setChecked((previous) => {
			const next = new Set(previous);

			if (next.has(permissionId)) {
				next.delete(permissionId);
			} else {
				next.add(permissionId);
			}

			return next;
		});
	};

	const saveGrants = async () => {
		if (!detail || grantsSaving) {
			return;
		}

		setGrantsSaving(true);
		setGrantsError(null);

		try {
			const updated = await replaceAdminRolePermissions(detail.roleId, [
				...checked,
			]);
			// The PUT response is the fresh role — adopt it instead of refetching.
			setDetailState({ status: "ready", detail: updated });
			setChecked(
				new Set(updated.permissions.map((grant) => grant.permissionId)),
			);
			setGrantsConfirmOpen(false);
			// Permission changes apply on the next request; the actor may hold
			// this role, so re-read their session.
			await useAuthStore.getState().revalidate();
			message.success(`Permissions updated for ${updated.name}.`);
		} catch (caught) {
			const outcome = await handleAdminAuthFailure(caught, router);
			setGrantsConfirmOpen(false);
			if (outcome === "forbidden" || outcome === "unauthorized") {
				setDetailState({ status: "forbidden" });
				return;
			}

			// Keep the draft so nothing the user checked is lost.
			setGrantsError(
				apiErrorMessage(
					caught,
					"Could not update permissions. Please try again.",
				),
			);
		} finally {
			setGrantsSaving(false);
		}
	};

	const saveMetadata = async () => {
		if (!detail || metaSaving || !metadataValid || !metadataDirty) {
			return;
		}

		setMetaSaving(true);
		setMetaError(null);

		try {
			const updated = await patchAdminRole(detail.roleId, {
				name: name.trim(),
				description: description.trim(),
			});
			setDetailState({ status: "ready", detail: updated });
			// List rows carry summaries; drop the detail-only permissions list.
			const summary: AdminRoleSummary = {
				roleId: updated.roleId,
				code: updated.code,
				name: updated.name,
				description: updated.description,
				system: updated.system,
				createdAt: updated.createdAt,
				updatedAt: updated.updatedAt,
			};
			setRoles((previous) =>
				previous.map((role) =>
					role.roleId === updated.roleId ? { ...role, ...summary } : role,
				),
			);
			message.success(`Saved ${updated.name}.`);
		} catch (caught) {
			const outcome = await handleAdminAuthFailure(caught, router);
			if (outcome === "forbidden" || outcome === "unauthorized") {
				setDetailState({ status: "forbidden" });
				return;
			}

			// The draft stays; the user can fix the value and retry.
			setMetaError(
				apiErrorMessage(caught, "Could not save the role. Please try again."),
			);
		} finally {
			setMetaSaving(false);
		}
	};

	const confirmDelete = async () => {
		if (!deleteTarget || deleting) {
			return;
		}

		setDeleting(true);

		try {
			await deleteAdminRole(deleteTarget.roleId);
			message.success(`Deleted ${deleteTarget.name}.`);
			if (selectedRoleId === deleteTarget.roleId) {
				setSelectedRoleId(null);
			}

			setDeleteTarget(null);
			setListReloadKey((key) => key + 1);
		} catch (caught) {
			await handleAdminAuthFailure(caught, router);
			setDeleteTarget(null);
			message.error(
				apiErrorMessage(caught, "Could not delete the role."),
			);
		} finally {
			setDeleting(false);
		}
	};

	if (!mayRoleRead) {
		return (
			<AdminCatalogTheme>
				<AccessDeniedState
					title="You do not have access to roles"
					description="Ask an administrator for the role:read permission."
				/>
			</AdminCatalogTheme>
		);
	}

	return (
		<AdminCatalogTheme>
			<section className={styles.page}>
				<header className={styles.header}>
					<div>
						<Title level={1} className={styles.title}>
							Roles &amp; Permissions
						</Title>
						<Text type="secondary">
							Create roles, decide what each one can do, and review grants.
						</Text>
					</div>
					{mayCreate && (
						<Button
							type="primary"
							onClick={() => setCreateOpen(true)}
						>
							New role
						</Button>
					)}
				</header>

				{listState.status === "forbidden" ? (
					<AccessDeniedState
						title="You do not have access to roles"
						description="Ask an administrator for the role:read permission."
					/>
				) : listState.status === "error" ? (
					<ErrorState
						title="We couldn't load roles"
						description={listState.message}
						retryLabel="Try again"
						onRetry={() => setListReloadKey((key) => key + 1)}
					/>
				) : listState.status === "loading" ? (
					<LoadingState rows={5} label="Loading roles" />
				) : roles.length === 0 ? (
					<EmptyState
						title="No roles yet."
						action={
							mayCreate ? (
								<Button type="primary" onClick={() => setCreateOpen(true)}>
									New role
								</Button>
							) : undefined
						}
					/>
				) : (
					<div className={styles.layout}>
						<Card title="Roles" styles={{ body: { padding: 0 } }}>
							<div className={styles.roleList} role="list">
								{roles.map((role) => (
									<div
										key={role.roleId}
										className={styles.roleRow}
										role="listitem"
									>
										<Button
											type="text"
											block
											className={`${styles.roleButton}${
												selectedRoleId === role.roleId
													? ` ${styles.roleButtonSelected}`
													: ""
											}`}
											aria-label={role.name}
											aria-pressed={selectedRoleId === role.roleId}
											onClick={() => setSelectedRoleId(role.roleId)}
										>
											<span className={styles.roleIdentity}>
												<span className={styles.roleName}>{role.name}</span>
												<span className={styles.roleCode}>{role.code}</span>
											</span>
											{role.system && (
												<Tag variant="filled" className={styles.systemTag}>
													System
												</Tag>
											)}
										</Button>
										{mayDelete && !role.system && (
											<Button
												type="link"
												size="small"
												danger
												aria-label={`Delete ${role.name}`}
												onClick={() => setDeleteTarget(role)}
											>
												Delete
											</Button>
										)}
									</div>
								))}
							</div>
						</Card>

						<Card>
							{detailState.status === "idle" ||
							detailState.status === "loading" ? (
								<LoadingState rows={6} label="Loading role" />
							) : detailState.status === "forbidden" ? (
								<AccessDeniedState
									title="You do not have access to this role"
									description="Ask an administrator for the role:read permission."
								/>
							) : detailState.status === "error" ? (
								<ErrorState
									title="We couldn't load this role"
									description={detailState.message}
									retryLabel="Try again"
									onRetry={() => setDetailReloadKey((key) => key + 1)}
								/>
							) : (
								<div className={styles.detail}>
									<div className={styles.detailHeader}>
										<Title level={4} className={styles.detailName}>
											{detail?.name}
										</Title>
										<Tag variant="filled" className={styles.systemTag}>
											{detail?.code}
										</Tag>
										{detail?.system && (
											<Tag variant="filled" className={styles.systemTag}>
												System
											</Tag>
										)}
									</div>

									{customerRoleSelected && (
										<Alert
											type="info"
											showIcon
											className={styles.notice}
											title="The customer role cannot be edited or deleted."
										/>
									)}

									<div className={styles.metaForm}>
										<Input
											aria-label="Role name"
											value={name}
											maxLength={255}
											disabled={!editable || metaSaving}
											onChange={(event) => setName(event.target.value)}
										/>
										<Input.TextArea
											aria-label="Role description"
											value={description}
											maxLength={2000}
											showCount
											rows={3}
											disabled={!editable || metaSaving}
											onChange={(event) =>
												setDescription(event.target.value)
											}
										/>
										{metaError && (
											<Alert
												type="error"
												showIcon
												className={styles.notice}
												title={metaError}
											/>
										)}
										{mayUpdate && !customerRoleSelected && (
											<div>
												<Button
													type="default"
													loading={metaSaving}
													disabled={
														!metadataValid || !metadataDirty || metaSaving
													}
													onClick={() => void saveMetadata()}
												>
													Save role
												</Button>
											</div>
										)}
									</div>

									<Divider style={{ margin: 0 }} />

									<div className={styles.grantGroups}>
										{grantGroups.map((group) => (
											<fieldset
												key={group.resource}
												className={styles.grantGroup}
											>
												<legend className={styles.groupTitle}>
													{group.resource.charAt(0).toUpperCase() +
														group.resource.slice(1)}
												</legend>
												{group.items.map((permission) => {
													const locked = lockedPermissionIds.has(
														permission.permissionId,
													);

													return (
														<div
															key={permission.permissionId}
															className={styles.grantRow}
														>
															<Checkbox
																checked={checked.has(
																	permission.permissionId,
																)}
																disabled={
																	!editable ||
																	grantsSaving ||
																	locked
																}
																onChange={() =>
																	toggleGrant(permission.permissionId)
																}
															>
																<span className={styles.grantCode}>
																	{permission.code}
																</span>
																<span className={styles.grantName}>
																	{permission.name}
																</span>
															</Checkbox>
														</div>
													);
												})}
											</fieldset>
										))}
									</div>

									{detail && isAdminRole(detail) && (
										<Text type="secondary">
											The admin role must keep every user and role permission.
										</Text>
									)}

									{grantsError && (
										<Alert
											type="error"
											showIcon
											className={`${styles.notice} ${styles.grantsError}`}
											title={grantsError}
										/>
									)}

									{mayUpdate && !customerRoleSelected && (
										<div className={styles.grantsFooter}>
											<Text type="secondary">
												Saving replaces the role&apos;s entire permission
												set.
											</Text>
											<Button
												type="primary"
												disabled={!grantsDirty || grantsSaving}
												onClick={() => setGrantsConfirmOpen(true)}
											>
												Save permission changes
											</Button>
										</div>
									)}
								</div>
							)}
						</Card>
					</div>
				)}

				{createOpen && (
					<CreateRoleModal
						onClose={() => setCreateOpen(false)}
						onCreated={(created) => {
							setCreateOpen(false);
							setListReloadKey((key) => key + 1);
							setSelectedRoleId(created.roleId);
							message.success(`Created role ${created.name}.`);
						}}
					/>
				)}

				{deleteTarget && (
					<ConfirmDialog
						open
						title={`Delete ${deleteTarget.name}?`}
						description="The role is hidden from every list. This cannot be undone."
						confirmText="Delete"
						cancelText="Cancel"
						confirmLoading={deleting}
						onConfirm={confirmDelete}
						onCancel={() => setDeleteTarget(null)}
					/>
				)}

				{grantsConfirmOpen && detail && (
					<ConfirmDialog
						open
						title={`Save permission changes for ${detail.name}?`}
						description="This replaces the role's entire permission set."
						confirmText="Save permissions"
						cancelText="Cancel"
						confirmLoading={grantsSaving}
						onConfirm={saveGrants}
						onCancel={() => setGrantsConfirmOpen(false)}
					/>
				)}
			</section>
		</AdminCatalogTheme>
	);
}

interface CreateRoleFormValues {
	code: string;
	name: string;
	description?: string;
}

/**
 * Code is immutable once created and must match
 * `^[A-Za-z][A-Za-z0-9_]{1,49}$` — the backend enforces the same pattern,
 * lowercases the value on write and rejects duplicates (including
 * soft-deleted codes) with a 409. On failure the form keeps its values.
 */
function CreateRoleModal({
	onClose,
	onCreated,
}: {
	onClose: () => void;
	onCreated: (created: AdminRoleDetail) => void;
}) {
	const router = useRouter();
	const [form] = Form.useForm<CreateRoleFormValues>();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (values: CreateRoleFormValues) => {
		if (submitting) {
			return;
		}

		setSubmitting(true);
		setError(null);

		try {
			const created = await createAdminRole({
				code: values.code.trim(),
				name: values.name.trim(),
				description: values.description?.trim()
					? values.description.trim()
					: undefined,
			});
			onCreated(created);
		} catch (caught) {
			await handleAdminAuthFailure(caught, router);
			// Keep the draft so a conflict (for example a duplicate code) can
			// be resolved without retyping the form.
			setError(
				apiErrorMessage(caught, "Could not create the role. Please try again."),
			);
			setSubmitting(false);
		}
	};

	return (
		<Modal
			open
			title="Create role"
			okText="Create role"
			confirmLoading={submitting}
			onOk={() => form.submit()}
			onCancel={() => {
				if (!submitting) {
					onClose();
				}
			}}
			okButtonProps={{ disabled: submitting }}
			cancelButtonProps={{ disabled: submitting }}
			closable={!submitting}
			keyboard={!submitting}
			mask={{ closable: false }}
		>
			<Form<CreateRoleFormValues>
				form={form}
				layout="vertical"
				disabled={submitting}
				onFinish={submit}
			>
				<Form.Item
					name="code"
					label="Code"
					extra="Stored lowercase; cannot be changed later."
					rules={[
						{ required: true, whitespace: true, message: "Enter a code." },
						{
							pattern: /^[A-Za-z][A-Za-z0-9_]{1,49}$/,
							message:
								"Start with a letter and use only letters, digits, or underscores (max 50 characters).",
						},
					]}
				>
					<Input
						autoComplete="off"
						maxLength={50}
						placeholder="e.g. CATALOG_EDITOR"
					/>
				</Form.Item>
				<Form.Item
					name="name"
					label="Name"
					rules={[
						{ required: true, whitespace: true, message: "Enter a name." },
						{ max: 255, message: "Name must be at most 255 characters." },
					]}
				>
					<Input autoComplete="off" />
				</Form.Item>
				<Form.Item
					name="description"
					label="Description"
					rules={[
						{
							max: 2000,
							message: "Description must be at most 2000 characters.",
						},
					]}
				>
					<Input.TextArea rows={3} showCount maxLength={2000} />
				</Form.Item>
				{error && <Alert type="error" showIcon title={error} />}
			</Form>
		</Modal>
	);
}
