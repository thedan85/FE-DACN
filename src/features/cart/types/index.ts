import type { z } from "zod";

import type {
	CartDetailSchema,
	CartItemSchema,
	CompatibilityCheckSchema,
	CompatibilitySchema,
} from "../schema/cart.schema";

/** Cart DTO types (single source: `../schema/cart.schema.ts`). */

export type CartItem = z.infer<typeof CartItemSchema>;
export type Cart = z.infer<typeof CartDetailSchema>;
export type CartCompatibility = z.infer<typeof CompatibilitySchema>;
export type CompatibilityCheck = z.infer<typeof CompatibilityCheckSchema>;
