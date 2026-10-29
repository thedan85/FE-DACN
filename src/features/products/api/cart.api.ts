import { getAuthHeaders } from "@/features/auth/session";
import { ApiError, apiFetch } from "@/lib/api/client";
import { createApiResponseSchema } from "@/lib/api/schema";

import { CartItemSchema } from "../schema/cart.schema";
import type { CartItem } from "../types";

/**
 * Storefront cart write API (decision D13).
 *
 * `POST /api/v1/cart/items` requires authentication: an anonymous caller
 * receives **401** (verified live against backend `dev` @ `f758bae`). That
 * is surfaced as a distinct `auth-required` outcome so the purchase panel
 * can offer an honest "Sign in to purchase" prompt instead of faking a
 * successful add.
 *
 * Each call attaches `Authorization: Bearer <jwt>` from the in-memory auth
 * session when one exists (`getAuthHeaders` returns an empty set otherwise,
 * so anonymous callers still reach the honest 401 path). The token itself
 * is never persisted here.
 *
 * Nothing here throws: every failure is returned as a typed outcome so the
 * UI can render it rather than swallow it.
 */

const cartItemResponseSchema = createApiResponseSchema(CartItemSchema);

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
