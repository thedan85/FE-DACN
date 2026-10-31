import type { z } from "zod";

import type {
	CartDetailSchema,
	CartItemSchema,
} from "../schema/cart.schema";

/** Cart DTO types (single source: `../schema/cart.schema.ts`). */

export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartDetailSchema>;
