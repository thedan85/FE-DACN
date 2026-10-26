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
 * The `Authorization: Bearer <jwt>` header belongs to the centralized
 * `apiFetch` once the auth feature lands — this module deliberately carries
 * no token handling of its own. Until then every call is anonymous and
 * honestly resolves to `auth-required`.
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
