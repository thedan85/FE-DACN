import { z } from "zod";

/**
 * Cart DTO schemas, mirroring the backend response records under
 * `dto/response/cart/*` (verified against backend `dev` @ `f758bae` on
 * 2026-10-26). Kept separate from `catalog.schema.ts` so each schema file
 * mirrors one backend package.
 *
 * Unknown keys are stripped by default, so newly added backend fields do not
 * break parsing.
 */

/** `CartItemResponse` — what `POST /api/v1/cart/items` returns on success. */
export const CartItemSchema = z.object({
	cartItemId: z.string(),
	cartId: z.string(),
	/** Public string id — the same value the aggregate exposes (N5 fixed). */
	variantId: z.string(),
	sku: z.string(),
	quantity: z.number().int().positive(),
	price: z.number(),
	lineTotal: z.number(),
	productId: z.string(),
	productName: z.string(),
	thumbnail: z.string().nullable(),
	stock: z.number().int(),
	createdAt: z.string(),
	updatedAt: z.string(),
});
