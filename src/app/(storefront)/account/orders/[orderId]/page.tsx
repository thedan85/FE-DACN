import type { Metadata } from "next";

import { OrderDetailView } from "@/features/orders/components/order-detail-view";

export const metadata: Metadata = {
	title: "Order Details",
	description: "Follow your order, from our store to your aquarium.",
};

type OrderDetailPageProps = PageProps<"/account/orders/[orderId]">;

export default async function OrderDetailPage(props: OrderDetailPageProps) {
	const { orderId } = await props.params;

	return <OrderDetailView orderId={orderId} />;
}
