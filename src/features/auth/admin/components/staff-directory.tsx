"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	Alert,
	App,
	Button,
	Card,
	Form,
	Input,
	Modal,
	Pagination,
	Select,
	Table,
	Tag,
	Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { SearchOutlined } from "@ant-design/icons";

import type { PageData } from "@/features/products/types";
import { AdminCatalogTheme } from "@/features/products/admin/components/admin-catalog-theme";
import { apiErrorMessage } from "@/features/products/admin/model/api-error";
import {
	STORE_TIME_ZONE,
	formatDate,
} from "@/features/products/storefront/model/product-format";
import { AccessDeniedState } from "@/components/feedback/access-denied-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { useAuthStore } from "@/stores/auth-store";

import {
	createAdminUser,
	deleteAdminUser,
	listAdminUsers,
	setAdminUserRole,
	setAdminUserStatus,
} from "../api/admin-users.api";
import { listAdminRoles } from "../api/admin-roles.api";
import { handleAdminAuthFailure } from "../model/admin-auth-failure";
import type { AdminUser } from "../schema/admin-users.schema";
import styles from "./staff-directory.module.css";

const { Title, Text } = Typography;

const PAGE_SIZE = 20;
const MAX_PAGE = 10_000;
const DEFAULT_ROLE = "employee";

/**
 * Built-in roles offered until role discovery lands (or when the account
 * lacks `role:read`). A known custom code can be entered in the inline
 * input next to the select.
 */
const BUILT_IN_ROLE_OPTIONS = [
	{ value: "employee", label: "Employee" },
	{ value: "admin", label: "Administrator" },
];

/** The customer role is storefront-owned and can never hold staff. */
const STAFF_HIDDEN_ROLE_CODES = new Set(["customer"]);

interface StaffDirectoryQuery {
	role: string;
	status: "ACTIVE" | "LOCKED" | undefined;
	/** 1-based, the way the URL carries it. */
	page: number;
}

/**
 * Parses the untrusted URL into the directory's query. Cannot fail: an edited
 * or stale URL degrades to the default view rather than breaking the page.
 * The keyword is deliberately absent — it never goes in the URL.
 */
function parseQuery(
	searchParams: { get(name: string): string | null },
): StaffDirectoryQuery {
	const role = (searchParams.get("role") ?? DEFAULT_ROLE).trim() || DEFAULT_ROLE;
	const statusParam = searchParams.get("status");
	const status =
		statusParam === "ACTIVE" || statusParam === "LOCKED"
			? statusParam
			: undefined;
	const parsed = Number(searchParams.get("page") ?? "1");
	const page = Number.isInteger(parsed)
		? Math.min(Math.max(parsed, 1), MAX_PAGE)
		: 1;
	return { role, status, page };
}

function toSearchParams(query: StaffDirectoryQuery): Record<string, string> {
	const params: Record<string, string> = {};
	if (query.role !== DEFAULT_ROLE) params.role = query.role;
	if (query.status) params.status = query.status;
	if (query.page > 1) params.page = String(query.page);
	return params;
}

function toApiPage(page: number): number {
	return Math.max(page - 1, 0);
}

type DirectoryState =
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string; requestKey: string }
	| { status: "ready"; page: PageData<AdminUser>; requestKey: string };

/**
 * Staff & Permissions directory.
 *
 * URL-backed filters (role, status, one-based page) keep a filtered view
 * shareable; the keyword stays out of the URL on purpose, so a half-typed
 * search never leaks into a link the admin copies. Fetching follows the
 * catalog's `requestKey` convention: a result whose key no longer matches the
 * current query is stale, and stale reads are ignored.
 *
 * The list read is gated on `user:read` before any request is made; every
 * catch path runs through `handleAdminAuthFailure`, and a denied read renders
 * the shared access-denied state instead of the data.
 */
export function StaffDirectory() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	// The App-hook form sees the ConfigProvider theme; static message cannot.
	const { message } = App.useApp();
	const permissions = useAuthStore((state) => state.user?.permissions);
	const currentUserId = useAuthStore((state) => state.user?.userId);
	const mayRead = permissions?.includes("user:read") === true;
	const mayCreate = permissions?.includes("user:create") === true;
	const mayUpdate = permissions?.includes("user:update") === true;
	const mayDelete = permissions?.includes("user:delete") === true;
	const mayRoleRead = permissions?.includes("role:read") === true;

	const [keywordDraft, setKeywordDraft] = useState("");
	const [keyword, setKeyword] = useState("");
	const [customRoleCode, setCustomRoleCode] = useState("");
	const [state, setState] = useState<DirectoryState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);
	const [createOpen, setCreateOpen] = useState(false);
	const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
	const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
	const [roleOptions, setRoleOptions] = useState(BUILT_IN_ROLE_OPTIONS);

	// Live role choices need role:read; without it the built-in pair plus
	// the known-code input stay in place. The customer role is never offered:
	// the backend rejects it for staff assignment.
	useEffect(() => {
		if (!mayRoleRead) {
			return;
		}

		let active = true;

		listAdminRoles()
			.then((roles) => {
				if (!active) {
					return;
				}

				const options = roles
					.filter((role) => !STAFF_HIDDEN_ROLE_CODES.has(role.code))
					.map((role) => ({ value: role.code, label: role.name }));

				if (options.length > 0) {
					setRoleOptions(options);
				}
			})
			.catch(async (caught: unknown) => {
				if (!active) {
					return;
				}

				const outcome = await handleAdminAuthFailure(caught, router);
				if (!active) {
					return;
				}

				// A failed role discovery must not take down the directory;
				// the built-in pair and the known-code input stay available.
				if (outcome === "unhandled") {
					message.error(
						"Could not load roles. Showing the built-in role list.",
					);
				}
			});

		return () => {
			active = false;
		};
	}, [mayRoleRead, message, router]);

	const query = useMemo(() => parseQuery(searchParams), [searchParams]);
	const requestKey = JSON.stringify([
		query.role,
		query.status,
		query.page,
		keyword,
		reloadKey,
	]);
	const isFetching =
		state.status === "loading" ||
		((state.status === "ready" || state.status === "error") &&
			state.requestKey !== requestKey);

	useEffect(() => {
		if (!mayRead) {
			return;
		}
		let active = true;

		listAdminUsers({
			page: toApiPage(query.page),
			size: PAGE_SIZE,
			roleCode: query.role,
			keyword: keyword || undefined,
			status: query.status,
		})
			.then((page) => {
				if (active) {
					setState({ status: "ready", page, requestKey });
				}
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
					setState({
						status: "error",
						requestKey,
						message: apiErrorMessage(
							caught,
							"Could not load staff accounts. Check your connection and try again.",
						),
					});
					return;
				}
				// Denied read: hide the data; the helper redirects (401) or
				// refreshes permissions (403).
				setState({ status: "forbidden" });
			});

		return () => {
			active = false;
		};
	}, [mayRead, query.role, query.status, query.page, keyword, requestKey, router]);

	const updateQuery = useCallback(
		(next: Partial<StaffDirectoryQuery>) => {
			const merged: StaffDirectoryQuery = { ...query, ...next };
			const search = new URLSearchParams(toSearchParams(merged)).toString();
			router.replace(search ? `${pathname}?${search}` : pathname);
		},
		[query, router, pathname],
	);

	const commitKeyword = useCallback(
		(value: string) => {
			const trimmed = value.trim();
			setKeywordDraft(trimmed);
			setKeyword(trimmed);
			if (query.page !== 1) {
				updateQuery({ page: 1 });
			}
		},
		[query.page, updateQuery],
	);

	const clearFilters = useCallback(() => {
		setKeyword("");
		setKeywordDraft("");
		setCustomRoleCode("");
		router.replace(pathname);
	}, [router, pathname]);

	const pageData = state.status === "ready" ? state.page : null;
	const hasFilters =
		keyword !== "" ||
		query.role !== DEFAULT_ROLE ||
		query.status !== undefined;

	const handleCreated = useCallback((name: string) => {
		message.success(`Created ${name}.`);
		setCreateOpen(false);
		setReloadKey((key) => key + 1);
	}, [message]);

	const handleRoleSaved = useCallback((roleCode: string) => {
		message.success(`Role updated to ${roleCode}.`);
		setRoleTarget(null);
		setReloadKey((key) => key + 1);
	}, [message]);

	const handleStatusDone = useCallback(
		(name: string, action: "locked" | "unlocked") => {
			message.success(`${name} ${action}.`);
			setStatusTarget(null);
			setReloadKey((key) => key + 1);
		},
		[message],
	);

	const handleDeleted = useCallback(
		(name: string, wasLastRow: boolean) => {
			message.success(`Deleted ${name}.`);
			setDeleteTarget(null);
			if (wasLastRow && query.page > 1) {
				// The page we were on no longer exists: clamp to max(0,totalPages-1).
				updateQuery({ page: query.page - 1 });
				return;
			}
			setReloadKey((key) => key + 1);
		},
		[message, query.page, updateQuery],
	);

	const columns = useMemo<TableColumnsType<AdminUser>>(
		() => [
			{
				title: "Staff",
				key: "staff",
				render: (_, row) => (
					<div className={styles.staffCell}>
						<span className={styles.staffName}>{row.name}</span>
						<span className={styles.staffEmail}>{row.email}</span>
					</div>
				),
			},
			{
				title: "Role",
				key: "role",
				width: 150,
				render: (_, row) => <Text type="secondary">{row.roleName}</Text>,
			},
			{
				title: "Status",
				key: "status",
				width: 110,
				render: (_, row) => (
					<Tag
						variant="filled"
						className={`${styles.pill} ${
							row.status === "ACTIVE" ? styles.pillActive : styles.pillLocked
						}`}
					>
						{row.status === "ACTIVE" ? "Active" : "Locked"}
					</Tag>
				),
			},
			{
				title: "Last login",
				key: "lastLogin",
				width: 150,
				render: (_, row) =>
					formatDate(row.lastLogin, STORE_TIME_ZONE) ?? "Never",
			},
			{
				title: "Created",
				key: "created",
				width: 150,
				render: (_, row) =>
					formatDate(row.createdAt, STORE_TIME_ZONE) ?? "—",
			},
			{
				title: "Actions",
				key: "actions",
				width: 240,
				render: (_, row) => {
					// A row never offers actions that would lock, demote or delete
					// the signed-in administrator's own account.
					if (row.userId === currentUserId) {
						return <Text type="secondary">—</Text>;
					}

					return (
						<div className={styles.actions}>
							{mayUpdate && (
								<Button
									type="link"
									size="small"
									aria-label={`${
										row.status === "ACTIVE" ? "Lock" : "Unlock"
									} ${row.name}`}
									onClick={() => setStatusTarget(row)}
								>
									{row.status === "ACTIVE" ? "Lock" : "Unlock"}
								</Button>
							)}
							{mayUpdate && (
								<Button
									type="link"
									size="small"
									aria-label={`Change role for ${row.name}`}
									onClick={() => setRoleTarget(row)}
								>
									Change role
								</Button>
							)}
							{mayDelete && (
								<Button
									type="link"
									size="small"
									danger
									aria-label={`Delete ${row.name}`}
									onClick={() => setDeleteTarget(row)}
								>
									Delete
								</Button>
							)}
						</div>
					);
				},
			},
		],
		[mayUpdate, mayDelete, currentUserId],
	);

	const denied = (
		<AccessDeniedState
			title="You do not have access to staff accounts"
			description="Ask an administrator for the user:read permission."
		/>
	);

	return (
		<AdminCatalogTheme>
			<section className={styles.page}>
				<header className={styles.header}>
					<div>
						<Title level={1} className={styles.title}>
							Staff &amp; Permissions
						</Title>
						<Text type="secondary">
							Manage staff accounts, roles and access.
						</Text>
					</div>
					{mayRead && mayCreate && (
						<Button type="primary" onClick={() => setCreateOpen(true)}>
							Add staff
						</Button>
					)}
				</header>

				<Card styles={{ body: { padding: 0 } }}>
					<div className={styles.toolbar}>
						<form
							className={styles.searchForm}
							role="search"
							onSubmit={(event) => {
								event.preventDefault();
								commitKeyword(keywordDraft);
							}}
						>
							<Input
								className={styles.search}
								aria-label="Search staff by email or name"
								prefix={<SearchOutlined />}
								placeholder="Search by email or name…"
								value={keywordDraft}
								allowClear
								onChange={(event) => {
									setKeywordDraft(event.target.value);
									if (event.target.value === "") {
										commitKeyword("");
									}
								}}
							/>
						</form>
						<Select
							className={styles.select}
							aria-label="Filter by role"
							value={query.role}
							options={roleOptions}
							onChange={(value: string) =>
								updateQuery({ role: value, page: 1 })
							}
						/>
						<form
							className={styles.codeForm}
							onSubmit={(event) => {
								event.preventDefault();
								const code = customRoleCode.trim();
								if (code !== "") {
									setCustomRoleCode("");
									updateQuery({ role: code, page: 1 });
								}
							}}
						>
							<Input
								className={styles.codeInput}
								aria-label="Known role code"
								placeholder="Custom role code"
								maxLength={50}
								value={customRoleCode}
								onChange={(event) => setCustomRoleCode(event.target.value)}
							/>
							<Button htmlType="submit">Apply</Button>
						</form>
						<Select
							className={styles.select}
							aria-label="Filter by status"
							value={query.status ?? ""}
							options={[
								{ value: "", label: "All statuses" },
								{ value: "ACTIVE", label: "Active" },
								{ value: "LOCKED", label: "Locked" },
							]}
							onChange={(value: string) =>
								updateQuery({
									status:
										value === "ACTIVE" || value === "LOCKED"
											? value
											: undefined,
									page: 1,
								})
							}
						/>
					</div>

					{!mayRead ? (
						denied
					) : state.status === "forbidden" ? (
						denied
					) : state.status === "error" && !isFetching ? (
						<ErrorState
							title="We couldn't load staff accounts"
							description={state.message}
							retryLabel="Try again"
							onRetry={() => setReloadKey((key) => key + 1)}
						/>
					) : isFetching ? (
						<LoadingState rows={6} label="Loading staff accounts" />
					) : pageData === null || pageData.content.length === 0 ? (
						<EmptyState
							title={
								hasFilters
									? "No staff match these filters."
									: "No staff accounts yet."
							}
							action={
								hasFilters ? (
									<Button onClick={clearFilters}>Clear filters</Button>
								) : mayCreate ? (
									<Button type="primary" onClick={() => setCreateOpen(true)}>
										Add staff
									</Button>
								) : undefined
							}
						/>
					) : (
						<Table<AdminUser>
							rowKey="userId"
							dataSource={pageData.content}
							columns={columns}
							pagination={false}
						/>
					)}

					{!isFetching && pageData !== null && pageData.totalElements > 0 && (
						<footer className={styles.pagination}>
							<Pagination
								size="small"
								current={query.page}
								total={pageData.totalElements}
								pageSize={PAGE_SIZE}
								showSizeChanger={false}
								simple
								onChange={(next) => updateQuery({ page: next })}
							/>
						</footer>
					)}
				</Card>

				{createOpen && (
					<CreateStaffModal
						roleOptions={roleOptions}
						onClose={() => setCreateOpen(false)}
						onCreated={handleCreated}
					/>
				)}
				{roleTarget && (
					<RoleDialog
						key={roleTarget.userId}
						target={roleTarget}
						roleOptions={roleOptions}
						onClose={() => setRoleTarget(null)}
						onSaved={handleRoleSaved}
					/>
				)}
				{statusTarget && (
					<StatusActionModal
						target={statusTarget}
						onClose={() => setStatusTarget(null)}
						onDone={handleStatusDone}
					/>
				)}
				{deleteTarget && (
					<DeleteStaffModal
						target={deleteTarget}
						wasLastRow={
							pageData !== null && pageData.content.length === 1
						}
						onClose={() => setDeleteTarget(null)}
						onDone={handleDeleted}
					/>
				)}
			</section>
		</AdminCatalogTheme>
	);
}

interface CreateStaffFormValues {
	email: string;
	password: string;
	name: string;
	phone: string;
	address?: string;
	roleCode: string;
	customRoleCode?: string;
}

/**
 * The password lives only in form memory for as long as the dialog is open:
 * the modal unmounts on success or cancel, so nothing retains it afterwards.
 */
function CreateStaffModal({
	roleOptions,
	onClose,
	onCreated,
}: {
	roleOptions: { value: string; label: string }[];
	onClose: () => void;
	onCreated: (name: string) => void;
}) {
	const router = useRouter();
	const [form] = Form.useForm<CreateStaffFormValues>();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (values: CreateStaffFormValues) => {
		if (submitting) {
			return;
		}

		setSubmitting(true);
		setError(null);

		const roleCode = values.customRoleCode?.trim() || values.roleCode;

		try {
			const created = await createAdminUser({
				email: values.email.trim(),
				password: values.password,
				name: values.name.trim(),
				phone: values.phone.trim(),
				address: values.address?.trim() ? values.address.trim() : undefined,
				roleCode,
			});
			onCreated(created.name);
		} catch (caught) {
			await handleAdminAuthFailure(caught, router);
			setError(
				apiErrorMessage(caught, "Could not create the account. Please try again."),
			);
			setSubmitting(false);
		}
	};

	return (
		<Modal
			open
			title="Add staff account"
			okText="Create account"
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
			<Form<CreateStaffFormValues>
				form={form}
				layout="vertical"
				disabled={submitting}
				initialValues={{ roleCode: DEFAULT_ROLE }}
				onFinish={submit}
			>
				<Form.Item
					name="email"
					label="Email"
					rules={[
						{ required: true, message: "Enter an email." },
						{ type: "email", message: "Enter a valid email." },
						{ max: 255, message: "Email must be at most 255 characters." },
					]}
				>
					<Input autoComplete="off" />
				</Form.Item>
				<Form.Item
					name="password"
					label="Initial password"
					rules={[
						{ required: true, message: "Enter a password." },
						{ min: 8, message: "Password must be at least 8 characters." },
						{ max: 128, message: "Password must be at most 128 characters." },
					]}
				>
					<Input.Password autoComplete="new-password" />
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
					name="phone"
					label="Phone"
					rules={[
						{ required: true, message: "Enter a phone number." },
						{
							pattern: /^\+?\d{10,15}$/,
							message: "Phone must be 10–15 digits, optionally starting with +.",
						},
					]}
				>
					<Input autoComplete="off" />
				</Form.Item>
				<Form.Item
					name="address"
					label="Address"
					rules={[
						{ max: 255, message: "Address must be at most 255 characters." },
					]}
				>
					<Input autoComplete="off" />
				</Form.Item>
				<Form.Item name="roleCode" label="Role">
					<Select options={roleOptions} />
				</Form.Item>
				<Form.Item
					name="customRoleCode"
					label="Known role code"
					extra="Overrides the role select when filled in."
					rules={[
						{ max: 50, message: "Role code must be at most 50 characters." },
					]}
				>
					<Input placeholder="e.g. catalog_editor" autoComplete="off" />
				</Form.Item>
				{error && <Alert type="error" showIcon title={error} />}
			</Form>
		</Modal>
	);
}

function RoleDialog({
	target,
	roleOptions,
	onClose,
	onSaved,
}: {
	target: AdminUser;
	roleOptions: { value: string; label: string }[];
	onClose: () => void;
	onSaved: (roleCode: string) => void;
}) {
	const router = useRouter();
	const isInOptions = roleOptions.some(
		(option) => option.value === target.roleCode,
	);
	const [selected, setSelected] = useState(
		isInOptions ? target.roleCode : DEFAULT_ROLE,
	);
	const [custom, setCustom] = useState(isInOptions ? "" : target.roleCode);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const effective = custom.trim() || selected;

	const submit = async () => {
		if (submitting || effective === "" || effective === target.roleCode) {
			return;
		}

		setSubmitting(true);
		setError(null);

		try {
			const updated = await setAdminUserRole(target.userId, effective);
			onSaved(updated.roleCode);
		} catch (caught) {
			await handleAdminAuthFailure(caught, router);
			setError(apiErrorMessage(caught, "Could not change the role."));
			setSubmitting(false);
		}
	};

	return (
		<Modal
			open
			title={`Change role for ${target.name}`}
			okText="Save role"
			confirmLoading={submitting}
			onOk={() => void submit()}
			onCancel={() => {
				if (!submitting) {
					onClose();
				}
			}}
			okButtonProps={{ disabled: submitting || effective === target.roleCode }}
			cancelButtonProps={{ disabled: submitting }}
			closable={!submitting}
			keyboard={!submitting}
			mask={{ closable: false }}
		>
			<div className={styles.dialogStack}>
				<Text>
					Current role: <Text strong>{target.roleName}</Text>
				</Text>
				<Select
					className={styles.fullWidth}
					aria-label="Role"
					value={selected}
					options={roleOptions}
					onChange={setSelected}
				/>
				<Input
					aria-label="Known role code"
					placeholder="Custom role code"
					maxLength={50}
					value={custom}
					onChange={(event) => setCustom(event.target.value)}
				/>
				{error && <Alert type="error" showIcon title={error} />}
			</div>
		</Modal>
	);
}

function StatusActionModal({
	target,
	onClose,
	onDone,
}: {
	target: AdminUser;
	onClose: () => void;
	onDone: (name: string, action: "locked" | "unlocked") => void;
}) {
	const router = useRouter();
	const locking = target.status === "ACTIVE";
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async () => {
		if (submitting) {
			return;
		}

		setSubmitting(true);
		setError(null);

		try {
			await setAdminUserStatus(target.userId, locking ? "LOCKED" : "ACTIVE");
			onDone(target.name, locking ? "locked" : "unlocked");
		} catch (caught) {
			await handleAdminAuthFailure(caught, router);
			setError(
				apiErrorMessage(
					caught,
					`Could not ${locking ? "lock" : "unlock"} the account.`,
				),
			);
			setSubmitting(false);
		}
	};

	return (
		<Modal
			open
			title={`${locking ? "Lock" : "Unlock"} ${target.name}?`}
			okText={locking ? "Lock" : "Unlock"}
			confirmLoading={submitting}
			onOk={() => void submit()}
			onCancel={() => {
				if (!submitting) {
					onClose();
				}
			}}
			okButtonProps={
				locking ? { danger: true, disabled: submitting } : { disabled: submitting }
			}
			cancelButtonProps={{ disabled: submitting }}
			closable={!submitting}
			keyboard={!submitting}
			mask={{ closable: false }}
		>
			<Typography.Paragraph>
				{locking
					? "Locking revokes every refresh token for this account. It cannot sign in until it is unlocked."
					: "Unlocking re-enables sign-in. Previously revoked refresh tokens stay revoked; the user signs in again."}
			</Typography.Paragraph>
			{error && <Alert type="error" showIcon title={error} />}
		</Modal>
	);
}

function DeleteStaffModal({
	target,
	wasLastRow,
	onClose,
	onDone,
}: {
	target: AdminUser;
	/** True when the row being deleted is the only row on its page. */
	wasLastRow: boolean;
	onClose: () => void;
	onDone: (name: string, wasLastRow: boolean) => void;
}) {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async () => {
		if (submitting) {
			return;
		}

		setSubmitting(true);
		setError(null);

		try {
			await deleteAdminUser(target.userId);
			onDone(target.name, wasLastRow);
		} catch (caught) {
			await handleAdminAuthFailure(caught, router);
			setError(apiErrorMessage(caught, "Could not delete the account."));
			setSubmitting(false);
		}
	};

	return (
		<Modal
			open
			title={`Delete ${target.name}?`}
			okText="Delete"
			confirmLoading={submitting}
			onOk={() => void submit()}
			onCancel={() => {
				if (!submitting) {
					onClose();
				}
			}}
			okButtonProps={{ danger: true, disabled: submitting }}
			cancelButtonProps={{ disabled: submitting }}
			closable={!submitting}
			keyboard={!submitting}
			mask={{ closable: false }}
		>
			<Typography.Paragraph>
				{`This deletes ${target.email}. The account stops working immediately, refresh tokens are revoked, and it disappears from staff lists.`}
			</Typography.Paragraph>
			{error && <Alert type="error" showIcon title={error} />}
		</Modal>
	);
}
