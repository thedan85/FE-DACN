import type { Metadata } from "next";
import { Suspense } from "react";

import { CustomersView } from "@/features/auth/admin/components/customers-view";
import { LoadingState } from "@/components/feedback/loading-state";

export const metadata: Metadata = {
	title: "Customers",
};

/**
 * The directory reads its state from the URL (`status` plus a one-based page),
 * so the view needs a Suspense boundary: `useSearchParams` opts the subtree
 * out of static rendering, and without a fallback the whole route would be
 * client-rendered.
 */
export default function AdminCustomersPage() {
	return (
		<Suspense fallback={<LoadingState label="Loading customers" />}>
			<CustomersView />
		</Suspense>
	);
}
