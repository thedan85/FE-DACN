import type { UserAccountStatus } from "../schema/user.schema";

/**
 * The account status vocabulary, in one place.
 *
 * The API returns only `ACTIVE` and `LOCKED` for these screens (soft-deleted
 * users are filtered out before a response is built), so the mapping is total
 * and no screen has to decide what to show for an impossible value.
 */

/** A visual tone, not a colour; the pill component maps it to tokens. */
export type UserStatusTone = "success" | "danger";

const LABELS: Record<UserAccountStatus, string> = {
	ACTIVE: "Active",
	LOCKED: "Locked",
};

const TONES: Record<UserAccountStatus, UserStatusTone> = {
	ACTIVE: "success",
	LOCKED: "danger",
};

export function userStatusLabel(status: UserAccountStatus): string {
	return LABELS[status];
}

export function userStatusTone(status: UserAccountStatus): UserStatusTone {
	return TONES[status];
}

/** The value a status toggle should write: the opposite of the current one. */
export function toggledStatus(status: UserAccountStatus): UserAccountStatus {
	return status === "ACTIVE" ? "LOCKED" : "ACTIVE";
}
