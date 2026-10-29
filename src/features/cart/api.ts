import { z } from "zod";

import { getAuthHeaders } from "@/features/auth/session";
import { ApiError, apiFetch } from "@/lib/api/client";
import { createApiResponseSchema } from "@/lib/api/schema";

import { OrderSchema } from "@/features/orders/schema";
import type { Order } from "@/features/orders/schema";

import { CartDetailSchema, CartItemSchema } from "./schema";
import type { Cart, CartItem } from "./schema";

/**
 * Storefront cart API.
 *
 * Every cart endpoint requires authentication, so each request carries the
 * in-memory access token through `getAuthHeaders()`. None of these functions
 * swallow errors: `apiFetch` failures reach the caller as `ApiError`, which
 * the views render (401 included). `addToCart` is the one exception — the
 * purchase panel needs the 401 as a distinct, non-throwing outcome.
 */

const cartResponseSchema = createApiResponseSchema(CartDetailSchema);
const cartItemResponseSchema = createApiResponseSchema(CartItemSchema);
const orderResponseSchema = createApiResponseSchema(OrderSchema);
const paymentUrlResponseSchema = createApiResponseSchema(
	z.object({ payUrl: z.string().url() }),
);

function unexpectedShape(message: string, payload: unknown): ApiError {
	return new ApiError(message, 500, payload);
}

export async function getCart(): Promise<Cart> {
	const payload = await apiFetch<unknown>("cart", {
		headers: getAuthHeaders(),
	});
	const parsed = cartResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw unexpectedShape(
			"The cart response did not match the expected contract.",
			payload,
		);
	}

	return parsed.data.data;
}

export type AddToCartOutcome =
	/** The backend accepted the item; `item` is its confirmed state. */
	| { status: "added"; item: CartItem }
	/** 401 — the customer must sign in before purchasing (D13). */
	| { status: "auth-required" }
	/** Any other failure, with a message safe to show the user. */
	| { status: "error"; message: string };

export interface AddToCartInput {
	/** Public string variant id straight from the aggregate (N5 fixed). */
	variantId: string;
	/** Units to add; the backend rejects anything below 1. */
	quantity: number;
}

export async function addToCart(
	input: AddToCartInput,
): Promise<AddToCartOutcome> {
	const variantId = input.variantId.trim();

	if (!variantId) {
		return { status: "error", message: "Select a variant first." };
	}

	if (!Number.isInteger(input.quantity) || input.quantity < 1) {
		return {
			status: "error",
			message: "Choose a quantity of at least 1.",
		};
	}

	let payload: unknown;

	try {
		payload = await apiFetch<unknown>("cart/items", {
			method: "POST",
			headers: getAuthHeaders(),
			body: JSON.stringify({
				variantId,
				quantity: input.quantity,
			}),
		});
	} catch (error) {
		if (error instanceof ApiError) {
			if (error.status === 401) {
				return { status: "auth-required" };
			}

			return {
				status: "error",
				message:
					error.status === 0
						? "Can't reach the server. Please try again."
						: error.message,
			};
		}

		return {
			status: "error",
			message: "Something went wrong while adding to your cart.",
		};
	}

	const parsed = cartItemResponseSchema.safeParse(payload);

	if (!parsed.success) {
		return {
			status: "error",
			message: "The cart response did not match the expected contract.",
		};
	}

	return { status: "added", item: parsed.data.data };
}

/** `PATCH /cart/items/{id}` — sets the absolute quantity. */
export async function updateCartItem(
	cartItemId: string,
	quantity: number,
): Promise<CartItem> {
	if (!Number.isInteger(quantity) || quantity < 1) {
		throw new ApiError("Choose a quantity of at least 1.", 400);
	}

	const payload = await apiFetch<unknown>(
		`cart/items/${encodeURIComponent(cartItemId)}`,
		{
			method: "PATCH",
			headers: getAuthHeaders(),
			body: JSON.stringify({ quantity }),
		},
	);
	const parsed = cartItemResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw unexpectedShape(
			"The cart response did not match the expected contract.",
			payload,
		);
	}

	return parsed.data.data;
}

export async function removeCartItem(cartItemId: string): Promise<void> {
	await apiFetch<unknown>(
		`cart/items/${encodeURIComponent(cartItemId)}`,
		{
			method: "DELETE",
			headers: getAuthHeaders(),
		},
	);
}

export type CheckoutInput = {
	recipientName: string;
	phone: string;
	address: string;
	/**
	 * VN Pay is stored as `CREDIT_CARD` because the backend payment enum has
	 * no dedicated `VNPAY` value. COD keeps its own enum name.
	 */
	method: "COD" | "CREDIT_CARD";
};

export async function checkoutCart(input: CheckoutInput): Promise<Order> {
	const payload = await apiFetch<unknown>("cart/checkout", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(input),
	});
	const parsed = orderResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw unexpectedShape(
			"The order response did not match the expected contract.",
			payload,
		);
	}

	return parsed.data.data;
}

/** Only valid for a non-COD order that is still pending payment. */
export async function createVnpayPaymentUrl(
	orderId: string,
): Promise<string> {
	const payload = await apiFetch<unknown>(
		`payments/vnpay/${encodeURIComponent(orderId)}`,
		{
			method: "POST",
			headers: getAuthHeaders(),
		},
	);
	const parsed = paymentUrlResponseSchema.safeParse(payload);

	if (!parsed.success) {
		throw unexpectedShape(
			"The payment response did not match the expected contract.",
			payload,
		);
	}

	return parsed.data.data.payUrl;
}
