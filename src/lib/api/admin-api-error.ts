import { ApiError } from "./client";

export const SESSION_EXPIRED_MESSAGE = "Your session has ended";
export const FORBIDDEN_MESSAGE = "You don't have permission to do this";
export const CONNECTION_ERROR_MESSAGE = "We couldn't reach the server. Check your connection and try again.";

export type AdminApiFailure = {
	kind: "session-expired" | "forbidden" | "not-found" | "connection" | "message";
	message: string;
};

export function describeAdminApiFailure(caught: unknown, fallback: string): AdminApiFailure {
	if (!(caught instanceof ApiError)) return { kind: "message", message: fallback };
	if (caught.status === 0) return { kind: "connection", message: CONNECTION_ERROR_MESSAGE };
	if (caught.status === 401) return { kind: "session-expired", message: SESSION_EXPIRED_MESSAGE };
	if (caught.status === 403) return { kind: "forbidden", message: FORBIDDEN_MESSAGE };
	if (caught.status === 404) return { kind: "not-found", message: caught.message };
	return { kind: "message", message: caught.message.trim() || fallback };
}
