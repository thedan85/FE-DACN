import type { Metadata } from "next";

import { UserCreateForm } from "@/features/users/admin/components/user-create-form";

export const metadata: Metadata = {
	title: "Add user",
};

/**
 * The add-user route.
 *
 * Creating is a client-side request: the access token lives in memory on the
 * client, and the portal guard has already confirmed the account before this
 * mounts.
 */
export default function AdminUserCreatePage() {
	return <UserCreateForm />;
}
