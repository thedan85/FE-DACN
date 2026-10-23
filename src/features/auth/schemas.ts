import { z } from "zod";
import { createApiResponseSchema } from "@/lib/api/schema";

export const loginDataSchema = z.object({
	accessToken: z.string().min(1),
	expiresIn: z.number(),
	tokenType: z.string(),
});

export const loginResponseSchema = createApiResponseSchema(loginDataSchema);

export const registerDataSchema = z.object({
	userId: z.string(),
	email: z.string(),
});

export const registerResponseSchema =
	createApiResponseSchema(registerDataSchema);

export type LoginData = z.infer<typeof loginDataSchema>;
export type RegisterData = z.infer<typeof registerDataSchema>;
