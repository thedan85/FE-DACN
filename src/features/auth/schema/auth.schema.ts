import { z } from "zod";
import { createApiResponseSchema } from "@/lib/api/schema";

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

export const loginDataSchema = z.object({
	accessToken: z.string().min(1),
	expiresIn: z.number(),
	tokenType: z.string(),
	user: meDataSchema,
});

export const loginResponseSchema = createApiResponseSchema(loginDataSchema);

export const meResponseSchema = createApiResponseSchema(meDataSchema);

/** Registration returns the same session payload as login (auto sign-in). */
export const registerDataSchema = loginDataSchema;

export const registerResponseSchema =
	createApiResponseSchema(registerDataSchema);
