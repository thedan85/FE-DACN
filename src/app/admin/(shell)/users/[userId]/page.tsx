import type { Metadata } from "next";

import { UserDetailScreen } from "@/features/users/admin/components/user-detail-screen";

type UserDetailPageProps = {
	params: Promise<{ userId: string }>;
};

export const metadata: Metadata = {
	title: "User detail",
};

/**
 * The detail route.
 *
 * The account is loaded in the browser, not here: the access token lives in
 * memory on the client (`features/auth/session`), so a server render has no
 * credential to send. The portal guard has already confirmed the account
 * before this mounts.
 */
export default async function AdminUserDetailPage({
	params,
}: UserDetailPageProps) {
	const { userId } = await params;

	// Next already decodes route params; decoding again would corrupt an id
	// containing a literal `%` and can throw on a malformed sequence.
	return <UserDetailScreen userId={userId} />;
}
