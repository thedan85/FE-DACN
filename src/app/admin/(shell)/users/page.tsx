import type { Metadata } from "next";
import { Suspense } from "react";

import {
	UsersListSkeleton,
	UsersListing,
} from "@/features/users/admin/components/users-listing";

export const metadata: Metadata = {
	title: "User accounts",
};

/**
 * The listing reads its filters from the URL, so it needs a Suspense boundary:
 * `useSearchParams` opts the subtree out of static rendering, and without a
 * fallback the whole route would be client-rendered.
 */
export default function AdminUsersPage() {
	return (
		<Suspense fallback={<UsersListSkeleton />}>
			<UsersListing />
		</Suspense>
	);
}
