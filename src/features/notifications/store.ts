"use client";

import { create } from "zustand";
import { getSessionGeneration, onSessionChange } from "@/features/auth/session";
import type { RealtimeConnectionManager } from "@/features/realtime/connection-manager";
import type {
	RealtimeInterest,
	RealtimeInterestListener,
	RealtimeInterestState,
	ReconcileContext,
} from "@/features/realtime/types";
import { useAuthStore } from "@/stores/auth-store";
import {
	deleteNotification as deleteNotificationApi,
	getUnreadCount,
	listNotifications,
	markNotificationRead,
} from "./api/notifications.api";
import type {
	NotificationInboxResponse,
	NotificationListQuery,
	NotificationState,
	NotificationView,
} from "./types";

const INBOX_INTEREST: RealtimeInterest = { kind: "inbox" };
const initialReadiness: RealtimeInterestState = Object.freeze({
	admission: "unavailable",
	acknowledged: false,
	status: "disabled",
});

function freshState(): NotificationState {
	return {
		unreadCount: 0,
		revision: 0,
		countLoading: false,
		countError: null,
		list: [],
		page: 0,
		size: 20,
		filter: "ALL",
		totalElements: 0,
		listLoading: false,
		listError: null,
		readiness: initialReadiness,
	};
}

/** Owns the session/account fence and any in-flight requests; never React state. */
const controller = {
	account: null as string | null,
	generation: 0,
	controllers: new Set<AbortController>(),
	dirty: false,
	scheduled: false,
	epoch: 0,
	nextContext: undefined as ReconcileContext | undefined,
	releases: [] as Array<() => void>,
	listLoaded: false,
	/** Independent of revision: the newest list request wins on equal revisions. */
	listRequest: 0,
	configured: false,
};

function currentAccount(): string | null {
	const userId = useAuthStore.getState().user?.userId;
	return userId == null ? null : JSON.stringify([userId, getSessionGeneration()]);
}

type Request = {
	signal: AbortSignal;
	current: () => boolean;
	finish: () => void;
};

function newRequest(context?: ReconcileContext): Request {
	const active = new AbortController();
	controller.controllers.add(active);
	const abort = () => active.abort();
	context?.signal.addEventListener("abort", abort, { once: true });
	if (context?.signal.aborted) abort();
	const version = controller.generation;
	const account = controller.account;
	return {
		signal: active.signal,
		current: () =>
			controller.generation === version &&
			controller.account === account &&
			currentAccount() === account &&
			!active.signal.aborted &&
			(!context || (context.isCurrent() && !context.signal.aborted)),
		finish: () => {
			context?.signal.removeEventListener("abort", abort);
			controller.controllers.delete(active);
		},
	};
}

function abortAll(): void {
	for (const active of controller.controllers) active.abort();
	controller.controllers.clear();
}

function sameReadiness(left: RealtimeInterestState, right: RealtimeInterestState): boolean {
	return (
		left.admission === right.admission &&
		left.acknowledged === right.acknowledged &&
		left.status === right.status
	);
}

export type NotificationStore = NotificationState & {
	/** Provider-owned: registers the inbox consumer, then triggers the initial count read. */
	configure: (manager: RealtimeConnectionManager) => () => void;
	dispose: () => void;
	setFilter: (filter: NotificationState["filter"]) => void;
	setPage: (page: number) => void;
	loadList: (query?: NotificationListQuery) => Promise<void>;
	invalidate: () => void;
	markRead: (notificationId: string) => Promise<void>;
	deleteNotification: (notificationId: string) => Promise<void>;
};

export const useNotificationStore = create<NotificationStore>((set, get) => {
	function applySnapshot(data: { unreadCount: number; revision: number }): boolean {
		// A stale or lower revision never overwrites a newer applied revision.
		if (data.revision < get().revision) return false;
		set({ unreadCount: data.unreadCount, revision: data.revision });
		return true;
	}

	function startListRequest(): number {
		controller.listRequest += 1;
		return controller.listRequest;
	}

	function applyListResult(
		inbox: NotificationInboxResponse,
		listId: number,
		requested: { page: number; size: number; filter: NotificationState["filter"] },
	): void {
		// Count/revision keep the revision-only rule; list data needs the newest id too.
		const applied = applySnapshot(inbox);
		if (!applied || listId !== controller.listRequest) return;
		set({
			list: inbox.notifications.content as NotificationView[],
			totalElements: inbox.notifications.totalElements,
			page: inbox.notifications.page,
			size: inbox.notifications.size,
			filter: requested.filter,
		});
	}

	function applyReadiness(
		state: RealtimeInterestState,
		context?: ReconcileContext,
	): void {
		if (context && !context.isCurrent()) return;
		if (controller.account !== currentAccount()) return;
		if (sameReadiness(get().readiness, state)) return;
		set({ readiness: state });
	}

	function wave(context?: ReconcileContext): Promise<void> {
		const request = newRequest(context);
		const wantList = controller.listLoaded;
		return (async () => {
			try {
				set({ countLoading: true, countError: null });
				const count = await getUnreadCount(request.signal);
				if (!request.current()) return;
				applySnapshot(count);
				if (!wantList) return;

				const { page, size, filter } = get();
				set({ listLoading: true, listError: null });
				const listId = startListRequest();
				const inbox = await listNotifications(
					{ page, size, status: filter === "ALL" ? undefined : filter },
					request.signal,
				);
				if (!request.current()) return;
				applyListResult(inbox, listId, { page, size, filter });
			} catch (error) {
				if (request.current()) set({ countError: error, listError: error });
			} finally {
				request.finish();
				if (request.current()) set({ countLoading: false, listLoading: false });
			}
		})();
	}

	async function drain(): Promise<void> {
		while (controller.dirty) {
			controller.dirty = false;
			const context = controller.nextContext;
			controller.nextContext = undefined;
			await wave(context);
		}
	}

	function request(context?: ReconcileContext): void {
		controller.dirty = true;
		controller.nextContext = context;
		if (controller.scheduled) return;
		controller.scheduled = true;
		const epoch = controller.epoch;
		void (async () => {
			// Yield so same-turn registrations/invalidations coalesce before a wave.
			await Promise.resolve();
			if (controller.epoch !== epoch) {
				controller.scheduled = false;
				return;
			}
			controller.scheduled = false;
			await drain();
		})();
	}

	function invalidate(): void {
		controller.generation += 1;
		abortAll();
		void request();
	}

	function syncAccount(): void {
		const next = currentAccount();
		if (controller.account === next) return;
		controller.account = next;
		controller.epoch += 1;
		controller.generation += 1;
		controller.listRequest += 1;
		controller.scheduled = false;
		controller.dirty = false;
		abortAll();
		set(freshState());
		controller.listLoaded = false;
		if (controller.configured && next !== null) void request();
	}

	function applyAuthoritative(
		data: { unreadCount: number; revision: number },
		updateList: () => void,
	): void {
		if (!applySnapshot(data)) return;
		updateList();
	}

	return {
		...freshState(),

		configure(manager) {
			get().dispose();
			controller.account = currentAccount();
			if (controller.account === null) return () => {};
			controller.configured = true;

			const releases: Array<() => void> = [];
			releases.push(manager.onReconcile((context) => { void request(context); }));
			const observe: RealtimeInterestListener = (state, context) =>
				applyReadiness(state, context);
			releases.push(manager.onInterestState(INBOX_INTEREST, observe));
			releases.push(manager.subscribeInbox(() => { invalidate(); }));
			applyReadiness(manager.getInterestState(INBOX_INTEREST));
			releases.push(useAuthStore.subscribe(syncAccount));
			releases.push(onSessionChange(syncAccount));
			controller.releases = releases;

			// Registration is complete; only now fetch the bell count. Content stays on demand.
			void request();
			return () => { get().dispose(); };
		},

		dispose() {
			for (const release of controller.releases) release();
			controller.releases = [];
			controller.configured = false;
			controller.epoch += 1;
			controller.generation += 1;
			controller.listRequest += 1;
			controller.scheduled = false;
			controller.dirty = false;
			abortAll();
			controller.listLoaded = false;
			set(freshState());
		},

		setFilter(filter) {
			set({ filter });
		},

		setPage(page) {
			set({ page: Math.max(0, page) });
		},

		async loadList(query: NotificationListQuery = {}) {
			controller.listLoaded = true;
			const page = query.page ?? get().page;
			const size = query.size ?? get().size;
			const filter = query.filter ?? get().filter;
			set({ listLoading: true, listError: null });
			const req = newRequest();
			const listId = startListRequest();
			try {
				const inbox = await listNotifications(
					{ page, size, status: filter === "ALL" ? undefined : filter },
					req.signal,
				);
				if (!req.current()) return;
				applyListResult(inbox, listId, { page, size, filter });
			} catch (error) {
				if (req.current()) set({ listError: error });
			} finally {
				req.finish();
				if (req.current()) set({ listLoading: false });
			}
		},

		invalidate,

		async markRead(notificationId) {
			const req = newRequest();
			try {
				const result = await markNotificationRead(notificationId, req.signal);
				if (!req.current()) return;
				applyAuthoritative(result, () => {
					set((state) => ({
						list: state.list.map((item) =>
							item.notificationId === notificationId ? result.notification : item,
						),
					}));
				});
			} finally {
				req.finish();
			}
		},

		async deleteNotification(notificationId) {
			const req = newRequest();
			try {
				const result = await deleteNotificationApi(notificationId, req.signal);
				if (!req.current()) return;
				applyAuthoritative(result, () => {
					set((state) => ({
						list: state.list.filter((item) => item.notificationId !== notificationId),
					}));
				});
			} finally {
				req.finish();
			}
		},
	};
});
