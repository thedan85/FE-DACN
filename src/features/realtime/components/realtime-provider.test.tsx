import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockAuthState = {
	user: { userId: string } | null;
	status: "loading" | "authenticated" | "anonymous";
};

const { auth, fetchCredentials } = vi.hoisted(() => ({
	auth: {
		user: null,
		status: "anonymous",
	} as MockAuthState,
	fetchCredentials: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ getRealtimePublicEnv: () => null }));
vi.mock("../api/realtime.api", () => ({
	fetchRealtimeCredentials: fetchCredentials,
}));
vi.mock("@/stores/auth-store", () => ({
	useAuthStore: (selector: (state: MockAuthState) => unknown) => selector(auth),
}));

import { realtimeManager } from "../connection-manager";
import { RealtimeProvider } from "./realtime-provider";

describe("RealtimeProvider", () => {
	beforeEach(() => {
		auth.user = null;
		auth.status = "anonymous";
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		realtimeManager.stop();
		realtimeManager.setAccount(null);
	});

	it("renders nothing and starts/stops the shared manager", () => {
		const start = vi.spyOn(realtimeManager, "start");
		const stop = vi.spyOn(realtimeManager, "stop");
		const setAccount = vi.spyOn(realtimeManager, "setAccount");

		const { unmount, container } = render(<RealtimeProvider />);

		expect(container.innerHTML).toBe("");
		expect(start).toHaveBeenCalledTimes(1);
		expect(setAccount).toHaveBeenCalledWith(null);

		unmount();
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it("does not touch the manager while auth status is loading", () => {
		auth.status = "loading";
		const setAccount = vi.spyOn(realtimeManager, "setAccount");

		render(<RealtimeProvider />);

		expect(setAccount).not.toHaveBeenCalled();
	});

	it("starts a session for an authenticated account and clears it on logout", () => {
		const setAccount = vi.spyOn(realtimeManager, "setAccount");
		auth.user = { userId: "customer-1" };
		auth.status = "authenticated";

		const { rerender, unmount } = render(<RealtimeProvider />);
		expect(setAccount).toHaveBeenCalledWith("customer-1");

		setAccount.mockClear();
		auth.user = null;
		auth.status = "anonymous";
		rerender(<RealtimeProvider />);
		expect(setAccount).toHaveBeenCalledWith(null);

		unmount();
	});

	it("does not fetch credentials or open a socket when Realtime env is absent", () => {
		render(<RealtimeProvider />);

		expect(realtimeManager.getStatus()).toBe("degraded");
		expect(fetchCredentials).not.toHaveBeenCalled();
	});
});
