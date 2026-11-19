import type { Metadata } from "next";
import { Suspense } from "react";

import { StaffPermissionsView } from "@/features/auth/admin/components/staff-permissions-view";
import { LoadingState } from "@/components/feedback/loading-state";

export const metadata: Metadata = {
	title: "Staff & Permissions",
};

/**
 * Both tabs read their state from the URL (`tab`, plus the directory's
 * filters), so the view needs a Suspense boundary: `useSearchParams` opts
 * the subtree out of static rendering, and without a fallback the whole
 * route would be client-rendered.
 */
export default function AdminStaffPage() {
	return (
		<Suspense fallback={<LoadingState label="Loading staff accounts" />}>
			<StaffPermissionsView />
		</Suspense>
	);
}
