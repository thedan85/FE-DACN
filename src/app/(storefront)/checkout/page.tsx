import type { Metadata } from "next";

import { CheckoutView } from "@/features/cart/storefront/components/checkout-view";

export const metadata: Metadata = {
	title: "Checkout",
	description: "Confirm your delivery details and place your order.",
};

export default function CheckoutPage() {
	return <CheckoutView />;
}
