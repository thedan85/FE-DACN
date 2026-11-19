"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	Alert,
	App,
	Button,
	Card,
	Descriptions,
	Input,
	Modal,
	Pagination,
	Select,
	Table,
	Tag,
	Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
	CloseOutlined,
	EditOutlined,
	SearchOutlined,
} from "@ant-design/icons";

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
	getAdminUser,
	listAdminUsers,
	setAdminUserStatus,
} from "../api/admin-users.api";
import { handleAdminAuthFailure } from "../model/admin-auth-failure";
import { CustomerProfileForm } from "./customer-profile-form";
import type {
	AdminUser,
	AdminUserDetail,
} from "../schema/admin-users.schema";
import styles from "./customers-view.module.css";

const { Title, Text } = Typography;

const PAGE_SIZE = 20;
const MAX_PAGE = 10_000;
const CUSTOMER_ROLE = "customer";

interface CustomersQuery {
	status: "ACTIVE" | "LOCKED" | undefined;
	/** 1-based, the way the URL carries it. */
	page: number;
}

/**
 * Parses the untrusted URL into the directory's query. Cannot fail: an edited
 * or stale URL degrades to the default view rather than breaking the page.
 * `roleCode` is ignored on purpose — this directory is always the customer
 * role, and a `roleCode` copied out of a staff link is dropped silently.
 * The keyword is deliberately absent — it never goes in the URL.
 */
function parseQuery(
	searchParams: { get(name: string): string | null },
): CustomersQuery {
	const statusParam = searchParams.get("status");
	const status =
		statusParam === "ACTIVE" || statusParam === "LOCKED"
			? statusParam
			: undefined;
	const parsed = Number(searchParams.get("page") ?? "1");
	const page = Number.isInteger(parsed)
		? Math.min(Math.max(parsed, 1), MAX_PAGE)
		: 1;
	return { status, page };
}

function toSearchParams(query: CustomersQuery): Record<string, string> {
	const params: Record<string, string> = {};
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

type DetailState =
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string }
	| { status: "ready"; detail: AdminUserDetail };

/**
 * Customer directory. Same URL-backed filter and `requestKey` stale-read
 * conventions as the staff directory, with two differences: the list is
 * always scoped to the `customer` role, and the profile address is shown
 * only in the detail panel of the selected row — never in the table. Fetching
 * aborts on unmount/selection change and late results are ignored.
 *
 * The list read is gated on `user:read` before any request is made; lock and
 * unlock are gated independently on `user:update`, as is the Edit profile
 * action. Every catch path runs through `handleAdminAuthFailure`, and a
 * denied read renders the shared access-denied state instead of the data.
 */
export function CustomersView() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	// The App-hook form sees the ConfigProvider theme; static message cannot.
	const { message } = App.useApp();
	const permissions = useAuthStore((state) => state.user?.permissions);
	const mayRead = permissions?.includes("user:read") === true;
	const mayUpdate = permissions?.includes("user:update") === true;

	const [keywordDraft, setKeywordDraft] = useState("");
	const [keyword, setKeyword] = useState("");
	const [state, setState] = useState<DirectoryState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);
	const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null);
	const [editOpen, setEditOpen] = useState(false);
	const editProfileButtonRef = useRef<HTMLButtonElement>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [detailState, setDetailState] = useState<DetailState>({
		status: "loading",
	});
	const [detailReloadKey, setDetailReloadKey] = useState(0);

	const query = useMemo(() => parseQuery(searchParams), [searchParams]);
	const requestKey = JSON.stringify([
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
		const controller = new AbortController();
		let active = true;

		listAdminUsers(
			{
				page: toApiPage(query.page),
				size: PAGE_SIZE,
				roleCode: CUSTOMER_ROLE,
				keyword: keyword || undefined,
				status: query.status,
			},
			controller.signal,
		)
			.then((pageData) => {
				if (active) {
					setState({ status: "ready", page: pageData, requestKey });
				}
			})
			.catch(async (caught: unknown) => {
				if (!active || controller.signal.aborted) {
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
							"Could not load customers. Check your connection and try again.",
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
			controller.abort();
		};
	}, [mayRead, query.status, query.page, keyword, requestKey, router]);

	const updateQuery = useCallback(
		(next: Partial<CustomersQuery>) => {
			const merged: CustomersQuery = { ...query, ...next };
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
		router.replace(pathname);
	}, [router, pathname]);

	const pageData = state.status === "ready" ? state.page : null;
	const hasFilters = keyword !== "" || query.status !== undefined;

	// Detail read, keyed on the selected row. Selecting another row makes the
	// previous request stale: its result is dropped instead of overwriting the
	// new selection.
	useEffect(() => {
		if (!mayRead || selectedId === null) {
			return;
		}
		const controller = new AbortController();
		let active = true;

		setDetailState({ status: "loading" });

		getAdminUser(selectedId, controller.signal)
			.then((detail) => {
				if (active) {
					setDetailState({ status: "ready", detail });
				}
			})
			.catch(async (caught: unknown) => {
				if (!active || controller.signal.aborted) {
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
							"Could not load the customer detail.",
						),
					});
					return;
				}
				setDetailState({ status: "forbidden" });
			});

		return () => {
			active = false;
			controller.abort();
		};
	}, [mayRead, selectedId, detailReloadKey, router]);

	const handleStatusDone = useCallback(
		(name: string, action: "locked" | "unlocked") => {
			message.success(`${name} ${action}.`);
			setStatusTarget(null);
			setDetailReloadKey((key) => key + 1);
			const removesFromFilter =
				query.status !== undefined &&
				query.status !== (action === "locked" ? "LOCKED" : "ACTIVE");
			const wasOnlyRow =
				pageData !== null && pageData.content.length === 1;
			if (removesFromFilter && wasOnlyRow && query.page > 1) {
				// The page we were on is gone from the active filter: clamp to
				// the last remaining page.
				updateQuery({ page: query.page - 1 });
				return;
			}
			setReloadKey((key) => key + 1);
		},
		[message, pageData, query.page, query.status, updateQuery],
	);

	const handleProfileSaved = useCallback(() => {
		message.success("Customer profile updated.");
		setEditOpen(false);
		editProfileButtonRef.current?.focus();
		setDetailReloadKey((key) => key + 1);
		setReloadKey((key) => key + 1);
	}, [message]);

	const handleProfileEditorClose = useCallback(() => {
		setEditOpen(false);
		editProfileButtonRef.current?.focus();
	}, []);

	const columns = useMemo<TableColumnsType<AdminUser>>(
		() => [
			{
				title: "Customer",
				key: "customer",
				render: (_, row) => (
					<div className={styles.customerCell}>
						<span className={styles.customerName}>{row.name}</span>
						<span className={styles.customerEmail}>{row.email}</span>
					</div>
				),
			},
			{
				title: "Phone",
				key: "phone",
				width: 150,
				render: (_, row) => row.phone ?? "—",
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
				width: 200,
				render: (_, row) => {
					const selected = row.userId === selectedId;
					return (
						<div className={styles.actions}>
							<Button
								type="link"
								size="small"
								aria-label={`View details for ${row.name}`}
								aria-pressed={selected}
								onClick={() =>
									setSelectedId((current) =>
										current === row.userId ? null : row.userId,
									)
								}
							>
								Details
							</Button>
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
						</div>
					);
				},
			},
		],
		[mayUpdate, selectedId],
	);

	const denied = (
		<AccessDeniedState
			title="You do not have access to customer accounts"
			description="Ask an administrator for the user:read permission."
		/>
	);

	return (
		<AdminCatalogTheme>
			<section className={styles.page}>
				<header className={styles.header}>
					<div>
						<Title level={1} className={styles.title}>
							Customers
						</Title>
						<Text type="secondary">
							View customer accounts and manage their sign-in access.
						</Text>
					</div>
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
								aria-label="Search customers by email or name"
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
							title="We couldn't load customers"
							description={state.message}
							retryLabel="Try again"
							onRetry={() => setReloadKey((key) => key + 1)}
						/>
					) : isFetching ? (
						<LoadingState rows={6} label="Loading customers" />
					) : pageData === null || pageData.content.length === 0 ? (
						<EmptyState
							title={
								hasFilters
									? "No customers match these filters."
									: "No customers yet."
							}
							action={
								hasFilters ? (
									<Button onClick={clearFilters}>Clear filters</Button>
								) : undefined
							}
						/>
					) : (
						<Table<AdminUser>
							rowKey="userId"
							dataSource={pageData.content}
							columns={columns}
							pagination={false}
							rowClassName={(row) =>
								row.userId === selectedId ? styles.selectedRow : ""
							}
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

				{selectedId !== null && mayRead && (
					<Card
						title="Customer detail"
						extra={
							<div className={styles.actions}>
								{mayUpdate && (
									<Button
										ref={editProfileButtonRef}
										icon={<EditOutlined />}
										aria-label="Edit profile"
										onClick={() => setEditOpen(true)}
									>
										Edit profile
									</Button>
								)}
								<Button
									type="text"
									icon={<CloseOutlined />}
									aria-label="Close details"
									onClick={() => setSelectedId(null)}
								/>
							</div>
						}
					>
						{detailState.status === "loading" ? (
							<LoadingState rows={3} label="Loading customer detail" />
						) : detailState.status === "forbidden" ? (
							<AccessDeniedState
								title="You do not have access to this customer"
								description="Ask an administrator for the user:read permission."
							/>
						) : detailState.status === "error" ? (
							<ErrorState
								title="We couldn't load the customer detail"
								description={detailState.message}
								retryLabel="Try again"
								onRetry={() => setDetailReloadKey((key) => key + 1)}
							/>
						) : (
							<Descriptions
								size="small"
								column={{ xs: 1, sm: 2 }}
								items={[
									{ label: "Name", children: detailState.detail.name },
									{ label: "Email", children: detailState.detail.email },
									{
										label: "Phone",
										children: detailState.detail.phone ?? "—",
									},
									{
										label: "Address",
										children: detailState.detail.address ?? "—",
									},
									{ label: "Role", children: detailState.detail.roleName },
									{
										label: "Status",
										children: (
											<Tag
												variant="filled"
												className={`${styles.pill} ${
													detailState.detail.status === "ACTIVE"
														? styles.pillActive
														: styles.pillLocked
												}`}
											>
												{detailState.detail.status === "ACTIVE"
													? "Active"
													: "Locked"}
											</Tag>
										),
									},
									{
										label: "Last login",
										children:
											formatDate(detailState.detail.lastLogin, STORE_TIME_ZONE) ??
											"Never",
									},
									{
										label: "Created",
										children:
											formatDate(detailState.detail.createdAt, STORE_TIME_ZONE) ??
											"—",
									},
								]}
							/>
						)}
					</Card>
				)}

				{statusTarget && (
					<StatusActionModal
						target={statusTarget}
						onClose={() => setStatusTarget(null)}
						onDone={handleStatusDone}
					/>
				)}

				{editOpen && selectedId !== null && (
					<CustomerProfileForm
						userId={selectedId}
						onClose={handleProfileEditorClose}
						onSaved={handleProfileSaved}
					/>
				)}
			</section>
		</AdminCatalogTheme>
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
			// Rejected writes are not retried automatically; the dialog stays
			// open so the admin can read the reason and decide.
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
