"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	Alert,
	Button,
	Card,
	Pagination,
	Result,
	Skeleton,
	Table,
	Tabs,
	Tooltip,
	Typography,
	App,
} from "antd";
import type { TableColumnsType, TableProps } from "antd";
import {
	DeleteOutlined,
	EditOutlined,
	EyeOutlined,
} from "@ant-design/icons";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

import {
	listAdminUsers,
	setAdminUserStatus,
} from "../api/users.api";
import {
	DEFAULT_USERS_LISTING_QUERY,
	STAFF_DEFAULT_USERS_LISTING_QUERY,
	STAFF_PATH,
	USER_STATUS_TABS,
	USERS_PAGE_SIZE,
	parseStaffUsersListingQuery,
	parseUsersListingQuery,
	toUsersApiParams,
	toUsersListingHref,
	toUsersSearchParams,
	type UsersListingQuery,
} from "../model/listing-query";
import { USER_PERMISSIONS } from "../model/permissions";
import { CUSTOMER_ROLE_CODE } from "../model/roles";
import { normalizeUserConflict } from "../model/user-api-error";
import { displayName, formatUserDate } from "../model/user-format";
import { useUserApiFailure } from "../model/use-user-api-failure";
import type { UserAccountStatus, UserPage, UserSummary } from "../schema/user.schema";
import { useAdminRoles } from "../use-admin-roles";
import { useUserPermissions } from "../use-user-permissions";
import { AdminTheme } from "@/components/layout/admin-theme";
import { UserAvatar } from "./user-avatar";
import { UserDeleteDialog } from "./user-delete-dialog";
import { UserStatusPill } from "./user-status-pill";
import { UsersBulkBar } from "./users-bulk-bar";
import { UsersBulkDeleteDialog } from "./users-bulk-delete-dialog";
import { UsersToolbar } from "./users-toolbar";
import styles from "./users-listing.module.css";

const { Title, Text } = Typography;

/** The listing route, where the sidebar's "User accounts" item points. */
const LISTING_PATH = "/admin/users";

type UsersListingProps = {
	/**
	 * The `/admin/staff` compatibility screen: a staff-scoped view of the same
	 * directory. The role filter drops the customer role, the role URL parameter
	 * rejects it in every spelling, and staff mutations are suppressed whenever
	 * an unexpected customer row arrives. Detail links stay canonical.
	 */
	staff?: boolean;
};

type ListingState =
	| { status: "loading" }
	| { status: "error"; message: string; requestKey: string }
	| { status: "ready"; page: UserPage; requestKey: string };

function isCustomer(row: UserSummary): boolean {
	return row.roleCode.toLowerCase() === CUSTOMER_ROLE_CODE;
}

/**
 * User accounts listing.
 *
 * The URL is the state: filters and the page live in search params, so a
 * filtered view is shareable, survives a reload, and the back button works
 * without extra bookkeeping. `router.replace` rather than `push`, so typing a
 * search term does not fill the history stack with every keystroke.
 *
 * Fetching follows the catalog listing's `requestKey` convention: a result is
 * only rendered while its key matches the current query, so a slow response
 * for an old filter cannot overwrite a newer one. Loading is derived from that
 * comparison rather than stored as a second piece of state.
 */
export function UsersListing({ staff = false }: UsersListingProps = {}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { can, permissions } = useUserPermissions();
	const canRead = can(USER_PERMISSIONS.read);
	const canCreate = can(USER_PERMISSIONS.create);
	const canUpdate = can(USER_PERMISSIONS.update);
	const canDelete = can(USER_PERMISSIONS.delete);
	const canReadRoles = permissions?.includes("role:read") ?? false;
	// The staff route also admits role-only accounts. They have no reason to
	// see the user directory, so send them to the canonical roles screen.
	const roleOnlyRedirect = staff && !canRead && canReadRoles;
	const signedInUserId = useAuthStore((state) => state.user?.userId);
	const handleFailure = useUserApiFailure();
	const listingDefaults = staff
		? STAFF_DEFAULT_USERS_LISTING_QUERY
		: DEFAULT_USERS_LISTING_QUERY;
	/** Staff keyword: local state, because a keyword can carry PII. */
	const [staffKeyword, setStaffKeyword] = useState<string | undefined>(
		undefined,
	);

	const query = useMemo(() => {
		const parsed = (staff ? parseStaffUsersListingQuery : parseUsersListingQuery)(
			Object.fromEntries(searchParams.entries()),
		);

		return staff ? { ...parsed, keyword: staffKeyword } : parsed;
	}, [searchParams, staff, staffKeyword]);

	const apiParams = useMemo(() => toUsersApiParams(query), [query]);

	const [state, setState] = useState<ListingState>({ status: "loading" });
	/**
	 * Bumped by a retry or a completed delete. `router.refresh()` would re-render
	 * without re-running the fetch effect, because the effect depends only on
	 * the query — so the retry has to change something the effect watches.
	 */
	const [reloadKey, setReloadKey] = useState(0);
	const [deleteTarget, setDeleteTarget] = useState<UserSummary | null>(null);
	/** User ids selected on the current page, never across pages. */
	const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
	const [bulkLocking, setBulkLocking] = useState(false);
	const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
	const { notification } = App.useApp();

	const {
		roles,
		loading: rolesLoading,
		usingFallback: rolesFallback,
	} = useAdminRoles();

	const requestKey = JSON.stringify([
		query.keyword,
		query.roleCode,
		query.status,
		query.sort,
		query.page,
		reloadKey,
	]);

	// An error belongs to the request that produced it, not to the filter, so it
	// only counts while its key still matches. Narrowing on `"loading"` first
	// makes `requestKey` available on the other two arms.
	const isFetching =
		state.status === "loading" || state.requestKey !== requestKey;

	useEffect(() => {
		if (roleOnlyRedirect) {
			router.replace("/admin/roles");
		}
	}, [roleOnlyRedirect, router]);

	useEffect(() => {
		if (!canRead) {
			return;
		}

		let active = true;

		listAdminUsers(apiParams)
			.then((page) => {
				if (active) {
					setState({ status: "ready", page, requestKey });
				}
			})
			.catch((caught: unknown) => {
				if (!active) {
					return;
				}

				const failure = handleFailure(
					caught,
					"We couldn't load user accounts. Try again.",
				);

				setState({
					status: "error",
					requestKey,
					message: failure.message,
				});
			});

		return () => {
			active = false;
		};
	}, [
		canRead,
		apiParams,
		requestKey,
		handleFailure,
	]);

	const updateQuery = useCallback(
		(next: Partial<UsersListingQuery>) => {
			const merged: UsersListingQuery = { ...query, ...next };
			// Staff keeps the keyword in state only. Never serialise it: URLs
			// are logged and shared, and a keyword can carry customer PII.
			const urlQuery = staff ? { ...merged, keyword: undefined } : merged;
			const search = new URLSearchParams(
				toUsersSearchParams(urlQuery, listingDefaults),
			).toString();

			// A filter or page change replaces the rows, so a selection made on
			// the old page must not survive into a page the user cannot see.
			setSelectedRowKeys([]);
			router.replace(search ? `${pathname}?${search}` : pathname);
		},
		[query, router, pathname, listingDefaults, staff],
	);

	function clearFilters() {
		if (staff) {
			setStaffKeyword(undefined);
		}
		router.replace(
			toUsersListingHref(
				listingDefaults,
				staff ? STAFF_PATH : LISTING_PATH,
				listingDefaults,
			),
		);
	}

	const page = state.status === "ready" ? state.page : null;
	const rows = page?.content ?? [];
	// Staff mode: a customer row on the staff screen means the filter or the
	// backend response is off. Every staff mutation stays off for the page
	// until the anomaly clears, and customer rows get no detail links — the
	// canonical detail offers Delete.
	const hasCustomerRow = rows.some(isCustomer);
	const mutationsSuppressed = staff && hasCustomerRow;

	useEffect(() => {
		if (mutationsSuppressed) {
			setSelectedRowKeys((keys) => (keys.length > 0 ? [] : keys));
		}
	}, [mutationsSuppressed]);

	const columns = useMemo<TableColumnsType<UserSummary>>(() => {
		const allColumns: TableColumnsType<UserSummary> = [
			{
				title: "User",
				key: "user",
				render: (_, row) => (
					<div className={styles.userCell}>
						<UserAvatar name={row.name} email={row.email} />
						{staff && isCustomer(row) ? (
							// The canonical detail offers Delete; a customer row
							// on the staff screen must not link into it.
							<span className={styles.userName}>{displayName(row)}</span>
						) : (
							<Link
								className={styles.userName}
								href={`${LISTING_PATH}/${encodeURIComponent(row.userId)}`}
							>
								{displayName(row)}
							</Link>
						)}
					</div>
				),
			},
			{
				title: "Email",
				key: "email",
				render: (_, row) => (
					<span className={styles.email}>{row.email}</span>
				),
			},
			{
				title: "Phone",
				key: "phone",
				responsive: ["md"],
				render: (_, row) => (
					<Text type="secondary">{row.phone ?? "—"}</Text>
				),
			},
			{
				title: "Role",
				key: "role",
				responsive: ["md"],
				// Verbatim from the backend: a custom role's name is not ours to
				// translate or tidy.
				render: (_, row) => <Text>{row.roleName}</Text>,
			},
			{
				title: "Status",
				key: "status",
				responsive: ["md"],
				render: (_, row) => <UserStatusPill status={row.status} />,
			},
			{
				title: "Created",
				key: "createdAt",
				responsive: ["md"],
				render: (_, row) => (
					<Text type="secondary">{formatUserDate(row.createdAt)}</Text>
				),
			},
		];

		// Staff mode keeps the column even without a write permission: the
		// View link is the read-only way out. General mode keeps the old
		// behaviour — no column at all for read-only accounts.
		if (staff || canUpdate || canDelete) {
			allColumns.push({
				title: "Actions",
				key: "actions",
				align: "right",
				render: (_, row) => {
					const isSelf = row.userId === signedInUserId;
					const detailHref = `${LISTING_PATH}/${encodeURIComponent(row.userId)}`;
					const suppressLinks = staff && isCustomer(row);

					return (
						<div className={styles.actions}>
							{!suppressLinks && (
								<Button
									type="link"
									href={detailHref}
									icon={<EyeOutlined />}
									aria-label={`View ${displayName(row)}`}
								/>
							)}
							{canUpdate && !mutationsSuppressed && (
								<Button
									type="link"
									href={`${detailHref}/edit`}
									icon={<EditOutlined />}
									aria-label={`Edit ${displayName(row)}`}
								/>
							)}
							{canDelete &&
								!mutationsSuppressed &&
								(isSelf ? (
									<Tooltip title="You can't delete your own account">
										<span className={styles.disabledAction}>
											<Button
												type="link"
												danger
												disabled
												icon={<DeleteOutlined />}
												aria-label="You can't delete your own account"
											/>
										</span>
									</Tooltip>
								) : (
									<Button
										type="link"
										danger
										icon={<DeleteOutlined />}
										aria-label={`Delete ${displayName(row)}`}
										onClick={() => setDeleteTarget(row)}
									/>
								))}
						</div>
					);
				},
			});
		}

		return allColumns;
	}, [canUpdate, canDelete, signedInUserId, mutationsSuppressed, staff]);

	const hasFilters =
		Boolean(query.keyword ?? query.status) ||
		query.roleCode !== listingDefaults.roleCode ||
		query.sort !== listingDefaults.sort;
	const totalShown = rows.length;
	const firstShown =
		totalShown === 0 ? 0 : (query.page - 1) * USERS_PAGE_SIZE + 1;
	const lastShown = firstShown === 0 ? 0 : firstShown + totalShown - 1;

	const selectedUsers = rows.filter((row) =>
		selectedRowKeys.includes(row.userId),
	);

	const rowSelection: NonNullable<TableProps<UserSummary>["rowSelection"]> = {
		selectedRowKeys,
		onChange: (keys) => setSelectedRowKeys(keys.map(String)),
		// The backend refuses a self-delete; disabling the checkbox says so
		// before the request, and bulk actions cannot include the actor.
		getCheckboxProps: (row) => ({
			disabled: row.userId === signedInUserId,
		}),
	};

	async function lockSelected() {
		if (bulkLocking || selectedUsers.length === 0) {
			return;
		}

		setBulkLocking(true);

		const failures: Array<{ name: string; message: string }> = [];
		let locked = 0;
		let alreadyLocked = 0;

		for (const target of selectedUsers) {
			if (target.status === "LOCKED") {
				alreadyLocked += 1;
				continue;
			}

			try {
				await setAdminUserStatus(target.userId, "LOCKED");
				locked += 1;
			} catch (caught) {
				const failure = handleFailure(
					caught,
					"We couldn't lock this user. Try again.",
				);

				if (failure.kind === "session-expired") {
					setBulkLocking(false);
					return;
				}

				failures.push({
					name: displayName(target),
					message:
						caught instanceof ApiError && caught.status === 409
							? normalizeUserConflict(caught.message)
							: failure.message,
				});
			}
		}

		setBulkLocking(false);
		setSelectedRowKeys([]);
		setReloadKey((previous) => previous + 1);

		if (failures.length === 0) {
			notification.success({
				title: "Users locked",
				description:
					alreadyLocked > 0
						? `${locked} ${locked === 1 ? "account" : "accounts"} locked; ${alreadyLocked} already locked.`
						: `${locked} ${locked === 1 ? "account" : "accounts"} locked.`,
			});
		} else {
			notification.error({
				title: "Some users weren't locked",
				description: (
					<div>
						<p className={styles.bulkSummary}>
							{locked} of {selectedUsers.length} locked.
						</p>
						<ul className={styles.bulkFailures}>
							{failures.map((failure, index) => (
								<li key={`${failure.name}-${index}`}>
									<strong>{failure.name}</strong>: {failure.message}
								</li>
							))}
						</ul>
					</div>
				),
			});
		}
	}

	function handleBulkDeleted(deletedCount: number) {
		setSelectedRowKeys([]);

		// If the deletion emptied the page, step back rather than showing a
		// page that no longer has rows.
		if (page !== null && page.content.length <= deletedCount && query.page > 1) {
			updateQuery({ page: query.page - 1 });
		} else {
			setReloadKey((previous) => previous + 1);
		}
	}

	function handleDeleted(deleted: UserSummary) {
		setSelectedRowKeys((keys) =>
			keys.filter((key) => key !== deleted.userId),
		);

		// A deleted row leaves a hole; if it was the last row on a later page,
		// stepping back is more useful than showing an empty page.
		if (page !== null && page.content.length === 1 && query.page > 1) {
			updateQuery({ page: query.page - 1 });
		} else {
			setReloadKey((previous) => previous + 1);
		}
	}

	// The redirect effect above owns this view. Rendering the 403 panel here
	// would flash a denial at an account that is merely in the wrong place.
	if (roleOnlyRedirect) {
		return null;
	}

	return (
		<AdminTheme>
			<section className={styles.page}>
				<header className={styles.header}>
					<div>
						<Title level={1} className={styles.title}>
							{staff ? "Staff & Permissions" : "User accounts"}
						</Title>
						<Text type="secondary">
							{staff
								? "Manage staff accounts and access."
								: "Manage staff and customer accounts."}
						</Text>
					</div>
					{canCreate && !mutationsSuppressed && (
						<Button type="primary" href={`${LISTING_PATH}/new`}>
							{staff ? "Add staff" : "Add user"}
						</Button>
					)}
				</header>

				<Card styles={{ body: { padding: 0 } }}>
					{!canRead ? (
						<Result
							status="403"
							title={
								staff
									? "You don't have access to staff accounts"
									: "You don't have access to user accounts"
							}
							subTitle="Viewing accounts needs the user:read permission. Ask an administrator to grant it to your role."
							extra={<Button href="/admin/dashboard">Back to dashboard</Button>}
						/>
					) : (
						<>
							<Tabs
								className={styles.tabs}
								activeKey={query.status ?? "all"}
								items={USER_STATUS_TABS.map((tab) => ({
									key: tab.value ?? "all",
									label: tab.label,
								}))}
								onChange={(key) =>
									updateQuery({
										status:
											key === "all"
												? undefined
												: (key as UserAccountStatus),
										page: 1,
									})
								}
							/>

							<UsersToolbar
								query={query}
								roles={roles}
								rolesLoading={rolesLoading}
								rolesFallback={rolesFallback}
								staff={staff}
								onChange={updateQuery}
								onKeywordSubmit={(keyword) => {
									if (staff) {
										setStaffKeyword(keyword || undefined);
									}
									updateQuery({
										keyword: keyword || undefined,
										page: 1,
									});
								}}
							/>

							{mutationsSuppressed && (
								<Alert
									className={styles.suppression}
									type="warning"
									showIcon
									title="Customer accounts appear on this page"
									description={
										<>
											Staff actions are disabled while a customer
											account is shown. Manage customer accounts in the{" "}
											<Link href="/admin/customers">Customers directory</Link>.
										</>
									}
								/>
							)}

							{selectedRowKeys.length > 0 && !mutationsSuppressed && (
								<UsersBulkBar
									count={selectedRowKeys.length}
									busy={bulkLocking ? "lock" : null}
									canLock={canUpdate}
									canDelete={canDelete}
									onLock={() => void lockSelected()}
									onDelete={() => setBulkDeleteOpen(true)}
									onClear={() => setSelectedRowKeys([])}
								/>
							)}

							{state.status === "error" && !isFetching ? (
								<ErrorState
									title="We couldn't load user accounts"
									description={state.message}
									retryLabel="Try again"
									onRetry={() =>
										setReloadKey((previous) => previous + 1)
									}
								/>
							) : isFetching ? (
								<UsersListSkeleton />
							) : rows.length === 0 ? (
								<EmptyState
									title="No users found"
									description={
										hasFilters
											? "Try another search or clear your filters."
											: "No accounts have been created yet."
									}
									action={
										hasFilters ? (
											<Button onClick={clearFilters}>
												Clear filters
											</Button>
										) : undefined
									}
								/>
							) : (
								<Table<UserSummary>
									rowKey="userId"
									dataSource={rows}
									columns={columns}
									rowSelection={
										(canUpdate || canDelete) && !mutationsSuppressed
											? rowSelection
											: undefined
									}
									pagination={false}
								/>
							)}

							{state.status === "ready" &&
								!isFetching &&
								page !== null &&
								page.totalElements > 0 && (
									<footer className={styles.pagination}>
										<Text type="secondary" aria-live="polite">
											Showing {firstShown}–{lastShown} of{" "}
											{page.totalElements} users
										</Text>
										<Pagination
											size="small"
											current={query.page}
											total={page.totalElements}
											pageSize={USERS_PAGE_SIZE}
											showSizeChanger={false}
											simple
											onChange={(next) =>
												updateQuery({ page: next })
											}
										/>
									</footer>
								)}
						</>
					)}
				</Card>
			</section>

			<UserDeleteDialog
				user={deleteTarget}
				onClose={() => setDeleteTarget(null)}
				onDeleted={handleDeleted}
			/>

			<UsersBulkDeleteDialog
				users={bulkDeleteOpen ? selectedUsers : []}
				onClose={() => setBulkDeleteOpen(false)}
				onCompleted={handleBulkDeleted}
			/>
		</AdminTheme>
	);
}

/**
 * The listing's loading state: row silhouettes matching the table's shape, so
 * the page does not jump when the request resolves.
 */
export function UsersListSkeleton() {
	return (
		<div className={styles.skeleton} aria-busy="true" aria-live="polite">
			<span className={styles.srOnly}>Loading users…</span>
			{Array.from({ length: 5 }, (_, index) => (
				<div className={styles.skeletonRow} key={index} aria-hidden="true">
					<Skeleton.Avatar active size={34} />
					<Skeleton.Input active block style={{ height: 12 }} />
					<Skeleton.Input active style={{ width: 120, height: 12 }} />
				</div>
			))}
		</div>
	);
}
