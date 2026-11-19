import type { Metadata } from "next";

import { UserEditScreen } from "@/features/users/admin/components/user-edit-screen";

type UserEditPageProps = {
	params: Promise<{ userId: string }>;
};

export const metadata: Metadata = {
	title: "Edit user",
};

/**
 * The edit route.
 *
 * The account is loaded in the browser: the access token lives in memory on
 * the client, so a server render has no credential to send. The portal guard
 * has already confirmed the account before this mounts.
 */
export default async function AdminUserEditPage({ params }: UserEditPageProps) {
	const { userId } = await params;

	// Next already decodes route params; decoding again would corrupt an id
	// containing a literal `%` and can throw on a malformed sequence.
	return <UserEditScreen userId={userId} />;
}
