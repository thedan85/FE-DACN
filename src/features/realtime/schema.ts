import { z } from "zod";

export const RealtimeCredentialSchema = z.object({
	accessToken: z.string().min(1),
	expiresAt: z.iso.datetime(),
	admittedProductIds: z.array(z.string()),
	inboxTopic: z.string().nullable(),
});

export type RealtimeCredential = z.infer<typeof RealtimeCredentialSchema>;
