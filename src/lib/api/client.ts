
import { getPublicEnv } from "@/lib/env";

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly payload?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}
}

function getApiUrl(path: string): URL {
	const normalizedPath = path.replace(/^\/+/, "");

	if (
		!normalizedPath ||
		/^[a-z][a-z\d+.-]*:/i.test(normalizedPath) ||
		normalizedPath.startsWith("//")
	) {
		throw new Error(
			"API paths must be relative paths such as 'products' or 'products/123'.",
		);
	}

	const baseUrl = getPublicEnv().NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "");

	return new URL(`${normalizedPath}`, `${baseUrl}/`);
}

function getErrorMessage(payload: unknown, status: number): string {
	if (typeof payload === "object" && payload !== null) {
		const body = payload as Record<string, unknown>;

		for (const key of ["message", "detail", "title"]) {
			if (typeof body[key] === "string" && body[key].trim()) {
				return body[key];
			}
		}
	}

	return `API request failed with HTTP status ${status}.`;
}

export async function apiFetch<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const url = getApiUrl(path);
	const headers = new Headers(init.headers);

	if (!headers.has("Accept")) {
		headers.set("Accept", "application/json");
	}

	const isFormData =
		typeof FormData !== "undefined" && init.body instanceof FormData;

	if (init.body != null && !isFormData && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	let response: Response;

	try {
		response = await fetch(url, {
			cache: "no-store",
			...init,
			headers,
		});
	} catch (error) {
		throw new ApiError(
			error instanceof Error
				? `Could not reach the API: ${error.message}`
				: "Could not reach the API.",
			0,
			error,
		);
	}

	if (response.status === 204) {
		if (!response.ok) {
			throw new ApiError(
				`API request failed with HTTP status ${response.status}.`,
				response.status,
			);
		}

		return undefined as T;
	}

	const responseText = await response.text();
	let payload: unknown;

	if (responseText) {
		try {
			payload = JSON.parse(responseText);
		} catch {
			payload = responseText;
		}
	}

	if (!response.ok) {
		throw new ApiError(
			getErrorMessage(payload, response.status),
			response.status,
			payload,
		);
	}

	if (!responseText) {
		return undefined as T;
	}

	if (typeof payload === "string") {
		throw new ApiError(
			"The API returned a non-JSON response where JSON was expected.",
			response.status,
			payload,
		);
	}

	return payload as T;
}