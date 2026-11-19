import { beforeEach, afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

import { getAccessToken } from "@/features/auth/session";
import { handleAdminAuthFailure } from "./admin-auth-failure";

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
