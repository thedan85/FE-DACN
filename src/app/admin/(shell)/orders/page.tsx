import type { Metadata } from "next";

import { AdminCatalogTheme } from "@/features/products/admin/components/admin-catalog-theme";
import { StaffOrdersView } from "@/features/orders/admin/components/staff-orders-view";

export const metadata: Metadata = {
	title: "Orders",
};

/** No Suspense: the view keeps its state locally, nothing reads the URL. */
export default function AdminOrdersPage() {
	return (
		<AdminCatalogTheme>
			<StaffOrdersView />
		</AdminCatalogTheme>
	);
}
