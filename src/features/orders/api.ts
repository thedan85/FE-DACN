import { ApiError, apiFetch } from "@/lib/api/client";
import {
	createApiResponseSchema,
	createPageResponseSchema,
} from "@/lib/api/schema";
import { getAuthHeaders } from "@/features/auth/session";
import { z } from "zod";

import { OrderSchema } from "./schema";
import type { Order, OrderItem } from "./schema";

/**
 * Storefront order API, verified against the backend `OrderController` and
 * `OrderResponse` (backend `dev` @ `f758bae`).
 *
 * `OrderResponse` carries no product name or image — only `variantId` and
 * `sku`. The page fetches each unique variant once (public endpoint) to show
 * a readable product name, falling back to the SKU when the lookup fails.
 * shortcut: one lookup per unique variant, all in parallel; revisit if an
 * order page can ever hold dozens of unique variants.
 */

const ordersResponseSchema = createApiResponseSchema(
	createPageResponseSchema(OrderSchema),
);
/** `VariantResponse` — the `/variants/{id}` payload (no `id` field). */
const variantResponseSchema = createApiResponseSchema(
	z.object({
		variantId: z.string(),
		sku: z.string(),
		productName: z.string(),
	}),
);

export type OrderItemView = OrderItem & {
	productName: string | null;
};

export type OrderView = Omit<Order, "items"> & {
	items: OrderItemView[];
};

export type OrderPage = {
	content: OrderView[];
	page: number;
	size: number;
	totalElements: number;
	totalPages: number;
};

async function getVariantName(variantId: string): Promise<string | null> {
	const payload = await apiFetch<unknown>(
		`variants/${encodeURIComponent(variantId)}`,
	);
	const parsed = variantResponseSchema.safeParse(payload);

	return parsed.success ? parsed.data.data.productName : null;
}

export async function listOrders(
	page = 0,
	size = 10,
): Promise<OrderPage> {
	const payload = await apiFetch<unknown>(
		`orders?page=${page}&size=${size}`,
		{ headers: getAuthHeaders() },
	);
	const parsed = ordersResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw new ApiError(
			"The order list response did not match the expected contract.",
			500,
			payload,
		);
	}

	const data = parsed.data.data;
	const variantIds = [
		...new Set(
			data.content.flatMap((order) =>
				order.items.map((item) => item.variantId),
			),
		),
	];

	const results = await Promise.allSettled(
		variantIds.map((variantId) => getVariantName(variantId)),
	);

	const names = new Map<string, string>();
	results.forEach((result, index) => {
		if (result.status === "fulfilled" && result.value) {
			names.set(variantIds[index], result.value);
		}
	});

	return {
		...data,
		content: data.content.map((order) => ({
			...order,
			items: order.items.map((item) => ({
				...item,
				productName: names.get(item.variantId) ?? null,
			})),
		})),
	};
}
