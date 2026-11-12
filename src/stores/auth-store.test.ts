import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MeData } from "@/features/auth/types";

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
