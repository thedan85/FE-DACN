import { refreshSession } from "@/features/auth/api/auth.api";
import {
	getAccessToken,
	getAuthHeaders,
	getSessionGeneration,
	updateAccessToken,
} from "@/features/auth/session";
import { ApiError, apiFetch } from "@/lib/api/client";
import { parseOrThrow } from "@/lib/api/parse";
import { createApiResponseSchema } from "@/lib/api/schema/api-response.schema";
import {
	RealtimeCredentialSchema,
	type RealtimeCredential,
} from "../schema";

let pendingRefresh: { generation: number; promise: Promise<void> } | null = null;

function assertCurrentSession(generation: number): void {
	if (getSessionGeneration() !== generation) {
		throw new ApiError(
			"The session changed during the Realtime credential request.",
			401,
		);
	}
}

function refreshAccessToken(generation: number): Promise<void> {
	if (pendingRefresh?.generation !== generation) {
		const promise = (async () => {
			const session = await refreshSession();
			assertCurrentSession(generation);
			updateAccessToken(session.accessToken, generation);
		})().finally(() => {
			if (pendingRefresh?.promise === promise) {
				pendingRefresh = null;
			}
		});
		pendingRefresh = { generation, promise };
	}

	return pendingRefresh.promise;
}

function postCredentials(productIds: string[]) {
	return apiFetch<unknown>("realtime/credentials", {
		method: "POST",
		headers: getAuthHeaders(),
		body: JSON.stringify({ productIds }),
	});
}

export async function fetchRealtimeCredentials(
	productIds: string[],
): Promise<RealtimeCredential> {
	const generation = getSessionGeneration();
	const authenticated = getAccessToken() !== null;
	let payload: unknown;

	try {
		payload = await postCredentials(productIds);
	} catch (error) {
		if (
			!(error instanceof ApiError) ||
			error.status !== 401 ||
			!authenticated ||
			getSessionGeneration() !== generation
		) {
			throw error;
		}

		await refreshAccessToken(generation);
		assertCurrentSession(generation);
		payload = await postCredentials(productIds);
	}

	assertCurrentSession(generation);
	const response = parseOrThrow(
		createApiResponseSchema(RealtimeCredentialSchema),
		payload,
		"Realtime credentials",
	);

	return response.data;
}
