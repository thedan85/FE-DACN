import type { z } from "zod";

import type {
	loginDataSchema,
	meDataSchema,
	registerDataSchema,
} from "../schema/auth.schema";

/** Auth DTO types (single source: `../schema/auth.schema.ts`). */

export type LoginData = z.infer<typeof loginDataSchema>;
export type RegisterData = z.infer<typeof registerDataSchema>;
export type MeData = z.infer<typeof meDataSchema>;
