import {
	getAuthHeaders,
	getSessionGeneration,
} from "@/features/auth/session";
import { ApiError, apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import {
	countResponseEnvelopeSchema,
	inboxResponseEnvelopeSchema,
	listNotificationsInputSchema,
	readResponseEnvelopeSchema,
	unreadCountResponseEnvelopeSchema,
} from "../schema";
import type {
	ListNotificationsInput,
	NotificationInboxResponse,
	NotificationReadResponse,
	NotificationUnreadCountResponse,
} from "../types";
import type { inboxCountSchema } from "../schema";
import type { z } from "zod";

type CountResponse = z.infer<typeof inboxCountSchema>;

/** A token refresh keeps its generation; a new/cleared session invalidates the flight. */
function sessionContext() {
	return { generation: getSessionGeneration(), headers: getAuthHeaders() };
}

function assertCurrentSession(generation: number): void {
	if (getSessionGeneration() !== generation) {
		throw new ApiError("The session changed during the notification request.", 401);
	}
}

export async function listNotifications(
	input: ListNotificationsInput = {},
	signal?: AbortSignal,
): Promise<NotificationInboxResponse> {
	const { page, size, status } = listNotificationsInputSchema.parse(input);
	const params = new URLSearchParams({ page: String(page), size: String(size) });
	if (status) params.set("status", status);
	const { generation, headers } = sessionContext();
	const payload = await apiFetch<unknown>(`notifications?${params.toString()}`, {
		headers,
		signal,
	});
	assertCurrentSession(generation);
	return parseOrThrow(
		inboxResponseEnvelopeSchema,
		payload,
		"Notification inbox response",
	).data;
}

export async function getUnreadCount(
	signal?: AbortSignal,
): Promise<NotificationUnreadCountResponse> {
	const { generation, headers } = sessionContext();
	const payload = await apiFetch<unknown>("notifications/unread-count", {
		headers,
		signal,
	});
	assertCurrentSession(generation);
	return parseOrThrow(
		unreadCountResponseEnvelopeSchema,
		payload,
		"Notification unread-count response",
	).data;
}

export async function markNotificationRead(
	notificationId: string,
	signal?: AbortSignal,
): Promise<NotificationReadResponse> {
	const { generation, headers } = sessionContext();
	const payload = await apiFetch<unknown>(
		`notifications/${encodeURIComponent(notificationId)}`,
		{ method: "PATCH", headers, body: JSON.stringify({ status: "READ" }), signal },
	);
	assertCurrentSession(generation);
	return parseOrThrow(
		readResponseEnvelopeSchema,
		payload,
		"Notification read response",
	).data;
}

export async function deleteNotification(
	notificationId: string,
	signal?: AbortSignal,
): Promise<CountResponse> {
	const { generation, headers } = sessionContext();
	const payload = await apiFetch<unknown>(
		`notifications/${encodeURIComponent(notificationId)}`,
		{ method: "DELETE", headers, signal },
	);
	assertCurrentSession(generation);
	return parseOrThrow(
		countResponseEnvelopeSchema,
		payload,
		"Notification delete response",
	).data;
}
