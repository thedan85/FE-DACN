import { z } from "zod";

import { getAuthHeaders } from "@/features/auth/session";
import { ApiError, apiFetch } from "@/lib/api/client";
import {
	PaymentMethodSchema,
	createApiResponseSchema,
	createPageResponseSchema,
} from "@/lib/api/schema";

import {
	OrderPageSchema,
	OrderSchema,
	PaymentStatusSchema,
} from "../schema/order.schema";
import type { Order, OrderPage, OrderPayment, OrderView } from "../types";

/**
 * Storefront order API, verified against the backend `OrderController`,
 * `PaymentController`, `VariantController`, `VariantAttributeController` and
 * `MediaController` (backend `dev` @ `f758bae`).
 *
 * `OrderResponse` carries no product name, image or payment fields — only
 * `variantId` and `sku`. The page enriches each unique variant and each
 * order with the public variant/media/attribute endpoints and the customer
 * payment endpoint. Every enrichment failure degrades to a fallback instead
 * of hiding the order list.
 *
 * shortcut: fetch every page (100 per request) so status/search/date filters
 * can run client-side, then fetch one payment and one variant summary per
 * unique id. Revisit when the backend exposes customer-side filtering or an
 * order page can hold hundreds of rows.
 */

const ordersResponseSchema = createApiResponseSchema(OrderPageSchema);
const orderResponseSchema = createApiResponseSchema(OrderSchema);
const variantResponseSchema = createApiResponseSchema(
	z.object({
		variantId: z.string(),
		sku: z.string(),
		productName: z.string(),
		productId: z.string(),
	}),
);
const mediaResponseSchema = createApiResponseSchema(
	createPageResponseSchema(
		z.object({
			url: z.string(),
		}),
	),
);
const attributesResponseSchema = createApiResponseSchema(
	createPageResponseSchema(
		z.object({
			attributeValue: z.string(),
		}),
	),
);
const paymentResponseSchema = createApiResponseSchema(
	z.object({
		method: PaymentMethodSchema,
		status: PaymentStatusSchema,
		transactionId: z.string().nullable(),
		paidAt: z.string().nullable(),
	}),
);

type VariantSummary = {
	productName: string | null;
	thumbnail: string | null;
	attributes: string[];
};

async function fetchOrderPage(page: number, size: number): Promise<OrderPage> {
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

	return parsed.data.data;
}

async function getMediaUrl(path: string): Promise<string | null> {
	const payload = await apiFetch<unknown>(path);
	const parsed = mediaResponseSchema.safeParse(payload);

	return parsed.success
		? (parsed.data.data.content.find((media) => media.url)?.url ?? null)
		: null;
}

async function getVariantSummary(variantId: string): Promise<VariantSummary> {
	const encodedId = encodeURIComponent(variantId);
	const [variantResult, attributesResult, variantMediaResult] =
		await Promise.allSettled([
			apiFetch<unknown>(`variants/${encodedId}`),
			apiFetch<unknown>(`variants/${encodedId}/attributes?size=50`),
			apiFetch<unknown>(`variants/${encodedId}/media?size=1`),
		]);

	const summary: VariantSummary = {
		productName: null,
		thumbnail: null,
		attributes: [],
	};
	let productId: string | null = null;

	if (variantResult.status === "fulfilled") {
		const parsed = variantResponseSchema.safeParse(variantResult.value);

		if (parsed.success) {
			summary.productName = parsed.data.data.productName;
			productId = parsed.data.data.productId;
		}
	}

	if (attributesResult.status === "fulfilled") {
		const parsed = attributesResponseSchema.safeParse(attributesResult.value);

		if (parsed.success) {
			summary.attributes = parsed.data.data.content
				.map((attribute) => attribute.attributeValue)
				.filter((value) => value.trim().length > 0);
		}
	}

	if (variantMediaResult.status === "fulfilled") {
		const parsed = mediaResponseSchema.safeParse(variantMediaResult.value);

		if (parsed.success) {
			summary.thumbnail = parsed.data.data.content[0]?.url ?? null;
		}
	}

	if (!summary.thumbnail && productId) {
		try {
			summary.thumbnail = await getMediaUrl(
				`products/${encodeURIComponent(productId)}/media?size=1`,
			);
		} catch {
			// A missing fallback image is not worth failing the whole order list.
		}
	}

	return summary;
}

/** Payment enrichment is optional; a 404/network failure only hides the label. */
async function getOrderPayment(orderId: string): Promise<OrderPayment | null> {
	try {
		const payload = await apiFetch<unknown>(
			`payments/orders/${encodeURIComponent(orderId)}`,
			{ headers: getAuthHeaders() },
		);
		const parsed = paymentResponseSchema.safeParse(payload);

		return parsed.success
			? {
					method: parsed.data.data.method,
					status: parsed.data.data.status,
					transactionId: parsed.data.data.transactionId,
					paidAt: parsed.data.data.paidAt,
				}
			: null;
	} catch {
		return null;
	}
}

async function enrichOrders(orders: Order[]): Promise<OrderView[]> {
	const variantIds = [
		...new Set(orders.flatMap((order) => order.items.map((item) => item.variantId))),
	];

	const [variantResults, paymentResults] = await Promise.all([
		Promise.allSettled(variantIds.map((variantId) => getVariantSummary(variantId))),
		Promise.all(orders.map((order) => getOrderPayment(order.orderId))),
	]);

	const variants = new Map<string, VariantSummary>();
	variantResults.forEach((result, index) => {
		if (result.status === "fulfilled") {
			variants.set(variantIds[index], result.value);
		}
	});

	const payments = new Map<string, OrderPayment>();
	paymentResults.forEach((payment, index) => {
		if (payment) {
			payments.set(orders[index].orderId, payment);
		}
	});

	return orders.map((order) => ({
		...order,
		payment: payments.get(order.orderId) ?? null,
		items: order.items.map((item) => {
			const variant = variants.get(item.variantId);

			return {
				...item,
				productName: variant?.productName ?? null,
				thumbnail: variant?.thumbnail ?? null,
				attributes: variant?.attributes ?? [],
			};
		}),
	}));
}

export async function listOrders(): Promise<OrderView[]> {
	const pageSize = 100;
	const firstPage = await fetchOrderPage(0, pageSize);
	const pages = [firstPage];

	for (let page = 1; page < firstPage.totalPages; page += 1) {
		pages.push(await fetchOrderPage(page, pageSize));
	}

	const orders = pages
		.flatMap((page) => page.content)
		.sort(
			(left, right) =>
				left.createdAt.localeCompare(right.createdAt) ||
				left.orderId.localeCompare(right.orderId),
		);

	return enrichOrders(orders);
}

export async function getOrder(orderId: string): Promise<OrderView> {
	const payload = await apiFetch<unknown>(
		`orders/${encodeURIComponent(orderId)}`,
		{ headers: getAuthHeaders() },
	);
	const parsed = orderResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw new ApiError(
			"The order response did not match the expected contract.",
			500,
			payload,
		);
	}

	const [order] = await enrichOrders([parsed.data.data]);

	return order;
}
