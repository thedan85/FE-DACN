import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

import { register } from "../../api/auth.api";
import { setAccessToken } from "../../session";
import { RegisterForm } from "./register-form";

const replace = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("../../api/auth.api", () => ({ register: vi.fn() }));
vi.mock("../../session", () => ({ setAccessToken: vi.fn() }));
vi.mock("@/stores/auth-store", () => ({
	useAuthStore: { setState: vi.fn() },
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

it("signs in the new account and lands on home", async () => {
	const user = {
		userId: "USR_1",
		email: "new@test.com",
		name: "New User",
		phone: null,
		address: null,
		roleCode: "CUSTOMER",
		roleName: "Customer",
		permissions: [],
		hasPassword: true,
	};
	vi.mocked(register).mockResolvedValue({
		accessToken: "access-token",
		expiresIn: 900,
		tokenType: "Bearer",
		user,
	});

	render(<RegisterForm />);
	fireEvent.change(screen.getByLabelText("Full name"), {
		target: { value: "New User" },
	});
	fireEvent.change(screen.getByLabelText("Email"), {
		target: { value: "new@test.com" },
	});
	fireEvent.change(screen.getByLabelText("Phone"), {
		target: { value: "0901234567" },
	});
	fireEvent.change(screen.getByLabelText("Password"), {
		target: { value: "password123" },
	});
	fireEvent.change(screen.getByLabelText("Confirm password"), {
		target: { value: "password123" },
	});
	fireEvent.click(screen.getByRole("checkbox"));
	fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

	await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
	expect(setAccessToken).toHaveBeenCalledWith("access-token");
	expect(useAuthStore.setState).toHaveBeenCalledWith({
		user,
		status: "authenticated",
	});
});
