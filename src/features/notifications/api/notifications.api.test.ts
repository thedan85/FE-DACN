import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, getSessionGeneration, setAccessToken } from "@/features/auth/session";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
	...await original<typeof import("@/lib/api/client")>(),
	apiFetch: apiFetchMock,
}));

import {
	deleteNotification,
	getUnreadCount,
	listNotifications,
	markNotificationRead,
} from "./notifications.api";

const envelope = (data: unknown) => ({ code: 200, message: "OK", data });
const row = {
	notificationId: "NOTI_1",
	userId: "USR_1",
	message: "Order confirmed",
	type: "ORDER",
	status: "UNREAD",
	createdAt: "2026-11-11T00:00:00Z",
	updatedAt: "2026-11-11T00:00:00Z",
	orderId: "ORD_1",
	eventType: "ORDER_CONFIRMED",
	orderSequence: 2,
	occurredAt: "2026-11-11T00:00:00Z",
};
const page = {
	content: [row],
	page: 0,
	size: 20,
	totalElements: 1,
	totalPages: 1,
};
const inbox = { notifications: page, unreadCount: 4, revision: 7 };
const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => { resolve = yes; });
	return { promise, resolve };
};

beforeEach(() => {
	apiFetchMock.mockReset();
	clearSession();
	setAccessToken("test-token");
});
afterEach(() => {
	clearSession();
	vi.unstubAllGlobals();
});

describe("notification inbox API", () => {
	it("lists page 0 / size 20 by default with auth headers", async () => {
		apiFetchMock.mockResolvedValue(envelope(inbox));
		await expect(listNotifications()).resolves.toEqual(inbox);
		expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith(
			"notifications?page=0&size=20",
			{ headers: { Authorization: "Bearer test-token" } },
		);
	});

	it("passes explicit page, size and status for all/unread filters", async () => {
		apiFetchMock.mockResolvedValue(envelope(inbox));
		await listNotifications({ page: 2, size: 50, status: "UNREAD" });
		expect(apiFetchMock.mock.calls[0][0]).toBe(
			"notifications?page=2&size=50&status=UNREAD",
		);
		await listNotifications({ page: 1, size: 1, status: "READ" });
		expect(apiFetchMock.mock.calls[1][0]).toBe(
			"notifications?page=1&size=1&status=READ",
		);
	});

	it.each([
		{ page: -1, size: 20 },
		{ page: 0, size: 0 },
		{ page: 0, size: 101 },
		{ page: 0, size: 20, status: "ALL" as const },
	])("rejects invalid list input before HTTP: %j", async (input) => {
		await expect(
			listNotifications(input as Parameters<typeof listNotifications>[0]),
		).rejects.toThrow();
		expect(apiFetchMock).not.toHaveBeenCalled();
	});

	it("reads the bell-only unread count", async () => {
		apiFetchMock.mockResolvedValue(envelope({ unreadCount: 4, revision: 7 }));
		await expect(getUnreadCount()).resolves.toEqual({ unreadCount: 4, revision: 7 });
		expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith(
			"notifications/unread-count",
			{ headers: { Authorization: "Bearer test-token" } },
		);
	});

	it("patches exactly {status:READ} and returns the authoritative body", async () => {
		const data = { notification: { ...row, status: "READ" }, unreadCount: 3, revision: 8 };
		apiFetchMock.mockResolvedValue(envelope(data));
		await expect(markNotificationRead("NOTI_1")).resolves.toEqual(data);
		expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith(
			"notifications/NOTI_1",
			{
				method: "PATCH",
				headers: { Authorization: "Bearer test-token" },
				body: JSON.stringify({ status: "READ" }),
			},
		);
	});

	it("soft-deletes with no guessed body and returns authoritative counts", async () => {
		const data = { unreadCount: 3, revision: 9 };
		apiFetchMock.mockResolvedValue(envelope(data));
		await expect(deleteNotification("NOTI_1")).resolves.toEqual(data);
		expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith(
			"notifications/NOTI_1",
			{ method: "DELETE", headers: { Authorization: "Bearer test-token" } },
		);
	});

	it.each([
		null,
		{},
		{ code: 200, message: "OK" },
		envelope({ ...inbox, notifications: undefined }),
		envelope({ ...inbox, unreadCount: "4" }),
		envelope({ notifications: { ...page, content: [{ ...row, status: "BOGUS" }] }, unreadCount: 4, revision: 7 }),
		envelope({ unreadCount: -1, revision: 7 }),
	])("rejects malformed success envelopes: %j", async (payload) => {
		apiFetchMock.mockResolvedValue(payload);
		await expect(listNotifications()).rejects.toMatchObject({ status: 500 });
	});

	it("rejects a malformed unread-count envelope", async () => {
		apiFetchMock.mockResolvedValue(envelope({ unreadCount: 4 }));
		await expect(getUnreadCount()).rejects.toMatchObject({ status: 500 });
	});

	it("rejects malformed mutation envelopes", async () => {
		apiFetchMock.mockResolvedValue(envelope({ unreadCount: 3 }));
		await expect(deleteNotification("NOTI_1")).rejects.toMatchObject({ status: 500 });
		apiFetchMock.mockResolvedValue(envelope({ notification: row, unreadCount: "3", revision: 8 }));
		await expect(markNotificationRead("NOTI_1")).rejects.toMatchObject({ status: 500 });
	});

	it("fences a refreshed session: a response from the old session is rejected", async () => {
		const generation = getSessionGeneration();
		const pending = deferred<unknown>();
		apiFetchMock.mockReturnValue(pending.promise);
		const request = listNotifications();
		setAccessToken("other-token");
		expect(getSessionGeneration()).toBe(generation + 1);
		pending.resolve(envelope(inbox));
		await expect(request).rejects.toMatchObject({ status: 401 });
	});

	it("propagates HTTP errors without swallowing them", async () => {
		const { ApiError } = await import("@/lib/api/client");
		const error = new ApiError("unavailable", 503);
		apiFetchMock.mockRejectedValue(error);
		await expect(getUnreadCount()).rejects.toBe(error);
		expect(apiFetchMock).toHaveBeenCalledTimes(1);
	});
});
