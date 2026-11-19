"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	Button,
	Card,
	Descriptions,
	Result,
	Skeleton,
	Tag,
	Tooltip,
	Typography,
} from "antd";
import {
	ArrowLeftOutlined,
	DeleteOutlined,
	EditOutlined,
} from "@ant-design/icons";

import { AdminTheme } from "@/components/layout/admin-theme";
import { ErrorState } from "@/components/feedback/error-state";
import { useAuthStore } from "@/stores/auth-store";

import { getAdminUser } from "../api/users.api";
import { USER_PERMISSIONS } from "../model/permissions";
import {
	displayName,
	formatLastLogin,
	formatUserDate,
} from "../model/user-format";
import { useUserApiFailure } from "../model/use-user-api-failure";
import type { UserDetail } from "../schema/user.schema";
import { useUserPermissions } from "../use-user-permissions";
import { UserAvatar } from "./user-avatar";
import { UserDeleteDialog } from "./user-delete-dialog";
import { UserStatusPill } from "./user-status-pill";
import styles from "./user-detail-screen.module.css";

const { Title, Text } = Typography;

/** Where the sidebar's "User accounts" item points. */
const LISTING_PATH = "/admin/users";

type DetailState =
	| { status: "loading" }
	| { status: "not-found" }
	| { status: "forbidden" }
	| { status: "error"; message: string }
	| { status: "ready"; user: UserDetail };

type UserDetailScreenProps = {
	userId: string;
};

/**
 * One account's profile and the role that grants its access.
 *
 * Everything shown comes from `GET admin/users/{userId}` — there are no order,
 * revenue, or activity panels, because the API has no such data and inventing
 * a placeholder would present a guess as a fact.
 *
 * A deleted user is a `404` on this endpoint, not a row with `DELETED`; that
 * becomes a not-found result rather than an error, because the account is
 * genuinely absent rather than the page having failed.
 */
export function UserDetailScreen({ userId }: UserDetailScreenProps) {
	const router = useRouter();
	const { can } = useUserPermissions();
	const canRead = can(USER_PERMISSIONS.read);
	const canUpdate = can(USER_PERMISSIONS.update);
	const canDelete = can(USER_PERMISSIONS.delete);
	const signedInUserId = useAuthStore((state) => state.user?.userId);
	const handleFailure = useUserApiFailure();

	const [state, setState] = useState<DetailState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);
	const [deleteOpen, setDeleteOpen] = useState(false);

	useEffect(() => {
		if (!canRead) {
			return;
		}

		let active = true;

		getAdminUser(userId)
			.then((user) => {
				if (active) {
					setState({ status: "ready", user });
				}
			})
			.catch((caught: unknown) => {
				if (!active) {
					return;
				}

				const failure = handleFailure(
					caught,
					"We couldn't load this user. Try again.",
				);

				if (failure.kind === "not-found") {
					setState({ status: "not-found" });
				} else if (failure.kind === "forbidden") {
					setState({ status: "forbidden" });
				} else {
					setState({ status: "error", message: failure.message });
				}
			});

		return () => {
			active = false;
		};
	}, [userId, canRead, reloadKey, handleFailure]);

	const retry = useCallback(
		() => setReloadKey((previous) => previous + 1),
		[],
	);

	const backToAccounts = (
		<Button href={LISTING_PATH}>Back to user accounts</Button>
	);

	if (!canRead) {
		return (
			<AdminTheme>
				<section className={styles.page}>
					<Result
						status="403"
						title="You don't have access to user accounts"
						subTitle="Viewing accounts needs the user:read permission. Ask an administrator to grant it to your role."
						extra={backToAccounts}
					/>
				</section>
			</AdminTheme>
		);
	}

	if (state.status === "loading") {
		return (
			<AdminTheme>
				<section className={styles.page}>
					<DetailSkeleton />
				</section>
			</AdminTheme>
		);
	}

	if (state.status === "not-found") {
		return (
			<AdminTheme>
				<section className={styles.page}>
					<Result
						status="404"
						title="User not found"
						subTitle="This account may have been deleted, or the link is wrong."
						extra={backToAccounts}
					/>
				</section>
			</AdminTheme>
		);
	}

	if (state.status === "forbidden") {
		return (
			<AdminTheme>
				<section className={styles.page}>
					<Result
						status="403"
						title="You don't have permission to view this account"
						subTitle="The account exists, but your role cannot read it."
						extra={backToAccounts}
					/>
				</section>
			</AdminTheme>
		);
	}

	if (state.status === "error") {
		return (
			<AdminTheme>
				<section className={styles.page}>
					<ErrorState
						title="We couldn't load this user"
						description={state.message}
						retryLabel="Try again"
						onRetry={retry}
						action={backToAccounts}
					/>
				</section>
			</AdminTheme>
		);
	}

	const user = state.user;
	const editHref = `${LISTING_PATH}/${encodeURIComponent(user.userId)}/edit`;
	const isSelf = user.userId === signedInUserId;

	return (
		<AdminTheme>
			<section className={styles.page}>
				<Link className={styles.back} href={LISTING_PATH}>
					<ArrowLeftOutlined aria-hidden="true" /> User accounts
				</Link>

				<header className={styles.header}>
					<div className={styles.identity}>
						<UserAvatar name={user.name} email={user.email} size="lg" />
						<div className={styles.identityText}>
							<Title level={1} className={styles.title}>
								{displayName(user)}
							</Title>
							<span className={styles.userId}>{user.userId}</span>
							<span className={styles.memberSince}>
								Member since {formatUserDate(user.createdAt)}
							</span>
						</div>
					</div>

					<div className={styles.headerActions}>
						{canUpdate && (
							<Button href={editHref} icon={<EditOutlined />}>
								Edit user
							</Button>
						)}
						{canDelete &&
							(isSelf ? (
								<Tooltip title="You can't delete your own account">
									<span className={styles.disabledAction}>
										<Button danger disabled icon={<DeleteOutlined />}>
											Delete user
										</Button>
									</span>
								</Tooltip>
							) : (
								<Button
									danger
									icon={<DeleteOutlined />}
									onClick={() => setDeleteOpen(true)}
								>
									Delete user
								</Button>
							))}
					</div>
				</header>

				<div className={styles.cards}>
					<Card title="Profile" className={styles.card}>
						<Descriptions
							column={1}
							colon={false}
							items={[
								{ key: "name", label: "Full name", children: displayName(user) },
								{ key: "email", label: "Email", children: user.email },
								{
									key: "phone",
									label: "Phone",
									children: user.phone ?? "—",
								},
								{
									key: "address",
									label: "Address",
									children: user.address ?? "Not provided",
								},
								{
									key: "lastLogin",
									label: "Last sign-in",
									children: formatLastLogin(user.lastLogin),
								},
							]}
						/>
					</Card>

					<Card title="Role & permissions" className={styles.card}>
						<Descriptions
							column={1}
							colon={false}
							items={[
								{
									key: "role",
									label: "Role",
									children: user.roleName,
								},
								{
									key: "status",
									label: "Status",
									children: <UserStatusPill status={user.status} />,
								},
							]}
						/>

						<div className={styles.permissions}>
							<Text type="secondary" className={styles.permissionsLabel}>
								Permissions
							</Text>
							{user.permissions.length === 0 ? (
								<Text type="secondary">
									This role grants no permissions.
								</Text>
							) : (
								<ul className={styles.permissionList}>
									{user.permissions.map((permission) => (
										<li key={permission}>
											<Tag>{permission}</Tag>
										</li>
									))}
								</ul>
							)}
						</div>
					</Card>
				</div>
			</section>

			<UserDeleteDialog
				user={deleteOpen ? user : null}
				onClose={() => setDeleteOpen(false)}
				onDeleted={() => router.replace(LISTING_PATH)}
			/>
		</AdminTheme>
	);
}

/** A card-shaped placeholder that keeps the header's height stable. */
function DetailSkeleton() {
	return (
		<div className={styles.skeleton} aria-busy="true" aria-live="polite">
			<span className={styles.srOnly}>Loading user…</span>
			<div className={styles.skeletonHeader} aria-hidden="true">
				<Skeleton.Avatar active size={64} />
				<div className={styles.skeletonText}>
					<Skeleton.Input active style={{ width: 220, height: 24 }} />
					<Skeleton.Input active style={{ width: 160, height: 12 }} />
				</div>
			</div>
			<Skeleton active paragraph={{ rows: 6 }} />
		</div>
	);
}
