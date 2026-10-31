import type { Metadata } from "next";

import { OrderHistoryView } from "@/features/orders/storefront/components/order-history-view";

export const metadata: Metadata = {
	title: "Order History",
	description: "Review the orders you have placed with us.",
};

export default function OrderHistoryPage() {
	return <OrderHistoryView />;
}
