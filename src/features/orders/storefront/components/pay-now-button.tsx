"use client";

import { useState } from "react";
import { App, Button } from "antd";

import { getAuthErrorMessage } from "@/features/auth/api/auth.api";
import { createVnpayPaymentUrl } from "@/features/cart/api/cart.api";

import type { OrderView } from "../../types";
import { canPayNow } from "../model/order-display";

type PayNowButtonProps = {
	order: OrderView;
	className?: string;
};

export function PayNowButton({ order, className }: PayNowButtonProps) {
	const { message } = App.useApp();
	const [paying, setPaying] = useState(false);

	if (!canPayNow(order)) {
		return null;
	}

	async function pay() {
		setPaying(true);

		try {
			const payUrl = await createVnpayPaymentUrl(order.orderId);
			const protocol = new URL(payUrl).protocol;

			if (protocol !== "https:" && protocol !== "http:") {
				throw new Error("Unsafe payment URL.");
			}

			window.location.assign(payUrl);
		} catch (error) {
			message.error(getAuthErrorMessage(error));
			setPaying(false);
		}
	}

	return (
		<Button className={className} loading={paying} onClick={() => void pay()}>
			{paying ? "Opening VN Pay…" : "Pay Now"}
		</Button>
	);
}
