import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminCatalogTheme } from "@/features/products/admin/components/admin-catalog-theme";
import {
	DashboardSkeleton,
	DashboardView,
} from "@/features/dashboard/admin/components/dashboard-view";

export const metadata: Metadata = {
	title: "Dashboard",
};

/**
 * The dashboard keeps its selected range in the URL, so the view reads
 * `useSearchParams`; the Suspense boundary keeps the rest of the route from
 * opting into client rendering.
 */
export default function AdminDashboardPage() {
	return (
		<AdminCatalogTheme>
			<Suspense fallback={<DashboardSkeleton />}>
				<DashboardView />
			</Suspense>
		</AdminCatalogTheme>
	);
}
