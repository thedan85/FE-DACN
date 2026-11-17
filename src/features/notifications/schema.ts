import { z } from "zod";
import { createApiResponseSchema } from "@/lib/api/schema/api-response.schema";
import { createPageResponseSchema } from "@/lib/api/schema/page-response.schema";
import {
	NotificationStatusSchema,
	NotificationTypeSchema,
} from "@/lib/api/schema/enums.schema";

export const notificationIdSchema = z.string().min(1);

export const notificationSchema = z.object({
	notificationId: z.string(),
	userId: z.string(),
	message: z.string(),
	type: NotificationTypeSchema,
	status: NotificationStatusSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
	orderId: z.string().nullable(),
	eventType: z.string().nullable(),
	orderSequence: z.number().int().nullable(),
	occurredAt: z.string().nullable(),
});

export const notificationPageSchema = createPageResponseSchema(notificationSchema);

export const notificationInboxResponseSchema = z.object({
	notifications: notificationPageSchema,
	unreadCount: z.number().int().nonnegative(),
	revision: z.number().int().nonnegative(),
});

export const inboxCountSchema = z.object({
	unreadCount: z.number().int().nonnegative(),
	revision: z.number().int().nonnegative(),
});

export const notificationReadResponseSchema = z.object({
	notification: notificationSchema,
	unreadCount: z.number().int().nonnegative(),
	revision: z.number().int().nonnegative(),
});

/** Defaults are page 0 / size 20; size is capped at 100 by the controller. */
export const listNotificationsInputSchema = z.object({
	page: z.number().int().nonnegative().default(0),
	size: z.number().int().min(1).max(100).default(20),
	status: z.enum(["UNREAD", "READ"]).optional(),
});

export const inboxResponseEnvelopeSchema = createApiResponseSchema(
	notificationInboxResponseSchema,
);
export const unreadCountResponseEnvelopeSchema = createApiResponseSchema(
	inboxCountSchema,
);
export const readResponseEnvelopeSchema = createApiResponseSchema(
	notificationReadResponseSchema,
);
export const countResponseEnvelopeSchema = createApiResponseSchema(
	inboxCountSchema,
);
