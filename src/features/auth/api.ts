import { ApiError, apiFetch } from "@/lib/api/client";
import { loginResponseSchema, registerResponseSchema } from "./schemas";

/**
 * Network/transport failures (status 0) stay generic; only HTTP responses may
 * carry a backend message meant for the user.
 */
export function getAuthErrorMessage(error: unknown): string {
	return error instanceof ApiError && error.status > 0
		? error.message
		: "Internal error";
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

export async function logout() {
	await apiFetch<unknown>("auth/logout", {
		method: "POST",
		credentials: "include",
	});
}
