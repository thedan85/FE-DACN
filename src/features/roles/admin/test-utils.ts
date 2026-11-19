import { vi } from "vitest";
import { useAuthStore } from "@/stores/auth-store";

export function signInRoleActor(permissions: string[], roleCode = "employee") {
	const user = {
		userId: "actor", email: "actor@example.com", name: "Actor", phone: null, address: null,
		roleCode, roleName: roleCode, hasPassword: true, permissions,
	};
	useAuthStore.setState({ status: "authenticated", user });
	return user;
}

export function stubRoleBrowser() {
	vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
	vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
}
