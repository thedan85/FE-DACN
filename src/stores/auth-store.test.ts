import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MeData } from "@/features/auth/types";
import { clearSession, getAccessToken, setAccessToken } from "@/features/auth/session";
import { ApiError } from "@/lib/api/client";

import { useAuthStore } from "./auth-store";

const api = vi.hoisted(() => ({
	refreshSession: vi.fn(),
	getMe: vi.fn(),
	logout: vi.fn(),
}));

vi.mock("@/features/auth/api/auth.api", () => api);

const me: MeData = {
	userId: "USR_1",
	email: "customer@example.com",
	name: "Customer",
	phone: null,
	address: null,
	roleCode: "customer",
	roleName: "Customer",
	permissions: [],
	hasPassword: true,
};

describe("auth store hydration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useAuthStore.setState({ user: null, status: "loading" });
	});

	it("marks the session ready before the profile finishes loading", async () => {
		let resolveMe: (value: MeData) => void = () => {};
		api.refreshSession.mockResolvedValue({
			accessToken: "token",
			expiresIn: 900,
			tokenType: "Bearer",
		});
		api.getMe.mockReturnValue(
			new Promise<MeData>((resolve) => {
				resolveMe = resolve;
			}),
		);

		const hydration = useAuthStore.getState().hydrate();

		await vi.waitFor(() => {
			expect(useAuthStore.getState().sessionReady).toBe(true);
		});
		expect(useAuthStore.getState().status).toBe("loading");

		resolveMe(me);
		await hydration;

		expect(useAuthStore.getState().status).toBe("authenticated");
		expect(useAuthStore.getState().user).toEqual(me);
	});
});

describe("auth store revalidation", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		clearSession();
		useAuthStore.setState({ user: me, status: "authenticated", sessionReady: true });
	});
	afterEach(() => { clearSession(); useAuthStore.setState({ user: null, status: "loading", sessionReady: false }); });

	it.each([401, 403])("fails closed when the refresh exchange rejects with HTTP %s", async (status) => {
		api.refreshSession.mockRejectedValue(new ApiError("Rejected", status));
		await useAuthStore.getState().revalidate();
		expect(useAuthStore.getState()).toMatchObject({ user: null, status: "anonymous", sessionReady: true });
		expect(getAccessToken()).toBeNull();
	});

	it.each([401, 403])("fails closed when the refreshed profile rejects with HTTP %s", async (status) => {
		api.refreshSession.mockResolvedValue({ accessToken: "new-token", expiresIn: 900, tokenType: "Bearer" });
		api.getMe.mockRejectedValue(new ApiError("Rejected", status));
		await useAuthStore.getState().revalidate();
		expect(useAuthStore.getState()).toMatchObject({ user: null, status: "anonymous", sessionReady: true });
		expect(getAccessToken()).toBeNull();
	});

	it("does not retain a cached identity after both access and refresh are rejected", async () => {
		setAccessToken("old-token");
		api.getMe.mockRejectedValue(new ApiError("Rejected", 401));
		api.refreshSession.mockRejectedValue(new ApiError("Rejected", 401));
		await useAuthStore.getState().revalidate();
		expect(useAuthStore.getState()).toMatchObject({ user: null, status: "anonymous", sessionReady: true });
		expect(getAccessToken()).toBeNull();
	});

	it("still refreshes an expired access token when the refresh cookie is valid", async () => {
		setAccessToken("old-token");
		api.getMe.mockRejectedValueOnce(new ApiError("Expired", 401)).mockResolvedValue(me);
		api.refreshSession.mockResolvedValue({ accessToken: "new-token", expiresIn: 900, tokenType: "Bearer" });
		await useAuthStore.getState().revalidate();
		expect(useAuthStore.getState()).toMatchObject({ user: me, status: "authenticated" });
		expect(getAccessToken()).toBe("new-token");
	});

	it.each(["profile", "refresh"])("preserves a resolved identity on a status-0 %s failure", async (stage) => {
		if (stage === "profile") setAccessToken("cached-token");
		api.getMe.mockRejectedValue(new ApiError("Offline", 0));
		api.refreshSession.mockRejectedValue(new ApiError("Offline", 0));
		await useAuthStore.getState().revalidate();
		expect(useAuthStore.getState()).toMatchObject({ user: me, status: "authenticated", sessionReady: true });
		// Preserve today's policy: the token is cleared, not the resolved account.
		expect(getAccessToken()).toBeNull();
		if (stage === "profile") expect(api.refreshSession).not.toHaveBeenCalled();
	});

	it("resolves anonymous on a transport failure when no identity was ever confirmed", async () => {
		useAuthStore.setState({ user: null, status: "loading", sessionReady: false });
		api.refreshSession.mockRejectedValue(new ApiError("Offline", 0));
		await useAuthStore.getState().revalidate();
		expect(useAuthStore.getState()).toMatchObject({ user: null, status: "anonymous", sessionReady: true });
	});
});
