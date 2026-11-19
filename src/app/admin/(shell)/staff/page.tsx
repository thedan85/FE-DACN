import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import {
	UsersListing,
	UsersListSkeleton,
} from "@/features/users/admin/components/users-listing";
import { rolesTabRedirect } from "@/features/users/admin/model/listing-query";

export const metadata: Metadata = {
	title: "Staff & Permissions",
};

type AdminStaffPageProps = {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * The `/admin/staff` compatibility route: the canonical user directory in a
 * staff-scoped mode. The retired `?tab=roles` destination now lives at
 * `/admin/roles`, which applies its own `role:read` gate, so the redirect
 * never crosses a permission boundary. The listing reads its filters from
 * the URL, hence the Suspense boundary.
 */
export default async function AdminStaffPage({
	searchParams,
}: AdminStaffPageProps) {
	const target = rolesTabRedirect((await searchParams).tab);

	if (target !== null) {
		redirect(target);
	}

	return (
		<Suspense fallback={<UsersListSkeleton />}>
			<UsersListing staff />
		</Suspense>
	);
}
