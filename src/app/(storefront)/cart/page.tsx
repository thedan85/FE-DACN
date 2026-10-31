import type { Metadata } from "next";

import { CartView } from "@/features/cart/storefront/components/cart-view";

export const metadata: Metadata = {
	title: "Your Cart",
	description: "Review your aquarium essentials before checkout.",
};

export default function CartPage() {
	return <CartView />;
}
