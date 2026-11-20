import { beforeEach, afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

import { getAccessToken } from "@/features/auth/session";
import {
	adminAuthFailureFeedback,
	handleAdminAuthFailure,
	recoveredAdminSession,
} from "./admin-auth-failure";

vi.mock("@/features/auth/session", () => ({
	getAccessToken: vi.fn(),
	setAccessToken: vi.fn(),
	clearSession: vi.fn(),
}));

const revalidate = vi.fn();
let originalRevalidate: () => Promise<void>;

beforeEach(() => {
	originalRevalidate = useAuthStore.getState().revalidate;
	revalidate.mockReset().mockResolvedValue(undefined);
	useAuthStore.setState({ revalidate });
	vi.mocked(getAccessToken).mockReset().mockReturnValue(null);
});

afterEach(() => {
	useAuthStore.setState({ revalidate: originalRevalidate });
});

it("adminAuthFailure_401RevalidatesAndRedirects", async () => {
	vi.mocked(getAccessToken).mockReturnValue(null);
	const replace = vi.fn();

	const outcome = await handleAdminAuthFailure(
		new ApiError("Unauthorized", 401),
		{ replace },
	);

	expect(revalidate).toHaveBeenCalledTimes(1);
	expect(replace).toHaveBeenCalledWith("/admin/login");
	expect(outcome).toBe("unauthorized");
});

it("adminAuthFailure_401KeepsThePageWhenASessionSurvives", async () => {
	vi.mocked(getAccessToken).mockReturnValue("fresh-token");
	const replace = vi.fn();

	const outcome = await handleAdminAuthFailure(
		new ApiError("Unauthorized", 401),
		{ replace },
	);

	expect(revalidate).toHaveBeenCalledTimes(1);
	expect(replace).not.toHaveBeenCalled();
	expect(outcome).toBe("unauthorized");
});

it("adminAuthFailure_403RefreshesPermissions", async () => {
	const replace = vi.fn();

	const outcome = await handleAdminAuthFailure(
		new ApiError("Access denied", 403),
		{ replace },
	);

	expect(revalidate).toHaveBeenCalledTimes(1);
	expect(replace).not.toHaveBeenCalled();
	expect(outcome).toBe("forbidden");
});

it("feedback_forbiddenNamesTheMissingPermission", () => {
	expect(adminAuthFailureFeedback("forbidden")).toBe(
		"You do not have permission to perform this action.",
	);
});

it("feedback_401WithoutASurvivingSessionSaysNothing", () => {
	vi.mocked(getAccessToken).mockReturnValue(null);

	// The redirect to /admin/login is already on its way; a toast would be
	// stale before it renders.
	expect(adminAuthFailureFeedback("unauthorized")).toBeNull();
});

it("feedback_401WithARehydratedSessionAsksForARetry", () => {
	vi.mocked(getAccessToken).mockReturnValue("fresh-token");

	expect(adminAuthFailureFeedback("unauthorized")).toBe(
		"Your session was refreshed. Please try again.",
	);
});

it("feedback_unhandledStaysTheCallersOwnBusiness", () => {
	expect(adminAuthFailureFeedback("unhandled")).toBeNull();
});

it("recoveredAdminSession_onlyMatchesRehydratedUnauthorized", () => {
	vi.mocked(getAccessToken).mockReturnValue("fresh-token");
	expect(recoveredAdminSession("unauthorized")).toBe(true);
	expect(recoveredAdminSession("forbidden")).toBe(false);
	expect(recoveredAdminSession("unhandled")).toBe(false);

	vi.mocked(getAccessToken).mockReturnValue(null);
	expect(recoveredAdminSession("unauthorized")).toBe(false);
});

it("leaves non-auth failures unhandled", async () => {
	const replace = vi.fn();

	expect(
		await handleAdminAuthFailure(new ApiError("Conflict", 409), { replace }),
	).toBe("unhandled");
	expect(await handleAdminAuthFailure(new Error("boom"), { replace })).toBe(
		"unhandled",
	);
	expect(revalidate).not.toHaveBeenCalled();
	expect(replace).not.toHaveBeenCalled();
});
