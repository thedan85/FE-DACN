import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockAuthState = {
	user: { userId: string } | null;
	status: "loading" | "authenticated" | "anonymous";
};

const { auth } = vi.hoisted(() => ({
	auth: { user: null, status: "anonymous" } as MockAuthState,
}));

vi.mock("@/stores/auth-store", () => ({
	useAuthStore: (selector: (state: MockAuthState) => unknown) => selector(auth),
}));

const configure = vi.fn(() => dispose);
const dispose = vi.fn();
vi.mock("../store", () => ({
	useNotificationStore: {
		getState: () => ({ configure, dispose }),
	},
}));

import { realtimeManager } from "@/features/realtime/connection-manager";
import { NotificationsProvider } from "./notifications-provider";

beforeEach(() => {
	auth.user = null;
	auth.status = "anonymous";
	configure.mockClear();
	dispose.mockClear();
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("NotificationsProvider", () => {
	it("renders nothing and does not configure while auth status is loading", () => {
		auth.status = "loading";
		const { container } = render(<NotificationsProvider />);
		expect(container.innerHTML).toBe("");
		expect(configure).not.toHaveBeenCalled();
		expect(dispose).not.toHaveBeenCalled();
	});

	it("registers the one store provider with the shared manager after session resolution", () => {
		auth.user = { userId: "customer-1" };
		auth.status = "authenticated";
		const { unmount } = render(<NotificationsProvider />);
		expect(configure).toHaveBeenCalledExactlyOnceWith(realtimeManager);
		unmount();
		expect(dispose).toHaveBeenCalledTimes(1);
	});

	it("disposes private state for anonymous sessions without configuring", () => {
		render(<NotificationsProvider />);
		expect(configure).not.toHaveBeenCalled();
		expect(dispose).toHaveBeenCalled();
	});

	it("reconfigures when a resolved session changes account", () => {
		auth.user = { userId: "customer-1" };
		auth.status = "authenticated";
		const { rerender, unmount } = render(<NotificationsProvider />);
		expect(configure).toHaveBeenCalledTimes(1);
		auth.user = null;
		auth.status = "anonymous";
		rerender(<NotificationsProvider />);
		expect(dispose).toHaveBeenCalled();
		unmount();
	});
});
