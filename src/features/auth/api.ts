import { ApiError, apiFetch } from "@/lib/api/client";
import { getAuthHeaders } from "./session";
import {
	loginResponseSchema,
	meResponseSchema,
	registerResponseSchema,
} from "./schemas";

/**
 * Network/transport failures (status 0) stay generic; only HTTP responses may
 * carry a backend message meant for the user.
 */
export function getAuthErrorMessage(error: unknown): string {
	return error instanceof ApiError && error.status > 0
		? error.message
		: "Unable to reach the server. Please check your connection and try again.";
}

export type LoginInput = {
	email: string;
	password: string;
};

export type RegisterInput = {
	name: string;
	email: string;
	phone: string;
	password: string;
};

export async function login(input: LoginInput) {
	const payload = await apiFetch<unknown>("auth/login", {
		method: "POST",
		body: JSON.stringify(input),
		credentials: "include",
	});

	return loginResponseSchema.parse(payload).data;
}

export async function loginWithGoogle(idToken: string) {
	const payload = await apiFetch<unknown>("auth/google", {
		method: "POST",
		body: JSON.stringify({ idToken }),
		credentials: "include",
	});

	return loginResponseSchema.parse(payload).data;
}

export async function register(input: RegisterInput) {
	const payload = await apiFetch<unknown>("auth/register", {
		method: "POST",
		body: JSON.stringify(input),
	});

	return registerResponseSchema.parse(payload).data;
}

/**
 * Exchanges the HttpOnly refresh cookie for a fresh access token.
 * `credentials: "include"` is required because the API is cross-origin in dev.
 */
export async function refreshSession() {
	const payload = await apiFetch<unknown>("auth/refresh", {
		method: "POST",
		credentials: "include",
	});

	return loginResponseSchema.parse(payload).data;
}

export async function getMe() {
	const payload = await apiFetch<unknown>("auth/me", {
		headers: getAuthHeaders(),
	});

	return meResponseSchema.parse(payload).data;
}

export type ProfileInput = {
	name: string;
	phone: string;
	address: string;
};

export async function updateProfile(input: ProfileInput) {
	const payload = await apiFetch<unknown>("auth/me", {
		method: "PATCH",
		headers: getAuthHeaders(),
		body: JSON.stringify(input),
	});

	return meResponseSchema.parse(payload).data;
}

export type ChangePasswordInput = {
	currentPassword: string;
	newPassword: string;
};

export async function changePassword(input: ChangePasswordInput) {
	await apiFetch<unknown>("auth/change-password", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify(input),
		credentials: "include",
	});
}

export async function logout() {
	await apiFetch<unknown>("auth/logout", {
		method: "POST",
		credentials: "include",
	});
}
