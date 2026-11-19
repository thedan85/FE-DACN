import type { Metadata } from "next";
import { Suspense } from "react";

import { StaffDirectory } from "@/features/auth/admin/components/staff-directory";
import { LoadingState } from "@/components/feedback/loading-state";

export const metadata: Metadata = {
	title: "Staff & Permissions",
};

/**
 * The directory reads its filters from the URL, so it needs a Suspense
 * boundary: `useSearchParams` opts the subtree out of static rendering, and
 * without a fallback the whole route would be client-rendered.
 */
export default function AdminStaffPage() {
	return (
		<Suspense fallback={<LoadingState label="Loading staff accounts" />}>
			<StaffDirectory />
		</Suspense>
	);
}
