import type { z } from "zod";
import type { RealtimeInterestState } from "@/features/realtime/types";
import type {
	inboxCountSchema,
	listNotificationsInputSchema,
	notificationInboxResponseSchema,
	notificationReadResponseSchema,
	notificationSchema,
} from "./schema";

export type NotificationFilter = "ALL" | "UNREAD" | "READ";
export type NotificationView = z.infer<typeof notificationSchema>;
export type NotificationInboxResponse = z.infer<typeof notificationInboxResponseSchema>;
export type NotificationUnreadCountResponse = z.infer<typeof inboxCountSchema>;
export type NotificationReadResponse = z.infer<typeof notificationReadResponseSchema>;
export type ListNotificationsInput = z.input<typeof listNotificationsInputSchema>;

export type NotificationListQuery = {
	page?: number;
	size?: number;
	filter?: NotificationFilter;
};

/** Shared account-scoped state. Bell, popover and pages select from this alone. */
export type NotificationState = Readonly<{
	unreadCount: number;
	revision: number;
	countLoading: boolean;
	countError: unknown | null;
	list: NotificationView[];
	page: number;
	size: number;
	filter: NotificationFilter;
	totalElements: number;
	listLoading: boolean;
	listError: unknown | null;
	readiness: RealtimeInterestState;
	/** On-demand latest-five preview; never overwrites the full inbox page. */
	preview: NotificationView[];
	previewLoading: boolean;
	previewError: unknown | null;
}>;
