import { z } from "zod";
import { createApiResponseSchema } from "@/lib/api/schema";

export const loginDataSchema = z.object({
	accessToken: z.string().min(1),
	expiresIn: z.number(),
	tokenType: z.string(),
});

export const loginResponseSchema = createApiResponseSchema(loginDataSchema);

export const meDataSchema = z.object({
	userId: z.string(),
	email: z.string(),
	name: z.string(),
	phone: z.string().nullable(),
	address: z.string().nullable(),
	roleCode: z.string(),
	roleName: z.string(),
	permissions: z.array(z.string()),
	hasPassword: z.boolean(),
});

export const meResponseSchema = createApiResponseSchema(meDataSchema);

export const registerDataSchema = z.object({
	userId: z.string(),
	email: z.string(),
});

export const registerResponseSchema =
	createApiResponseSchema(registerDataSchema);

export type LoginData = z.infer<typeof loginDataSchema>;
export type RegisterData = z.infer<typeof registerDataSchema>;
export type MeData = z.infer<typeof meDataSchema>;
