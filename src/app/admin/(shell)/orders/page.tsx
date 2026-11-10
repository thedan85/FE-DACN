import type { Metadata } from "next";
import { OrderManagementView } from "@/features/orders/admin/components/order-management-view";

export const metadata: Metadata = {
	title: "Orders",
};

export default function AdminOrdersPage() {
	return <OrderManagementView />;
}
