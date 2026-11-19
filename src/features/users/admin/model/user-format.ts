import type { UserSummary } from "../schema/user.schema";
import { formatAdminDate as formatUserDate } from "@/lib/utils/admin-date";
export { formatAdminDate as formatUserDate } from "@/lib/utils/admin-date";

/**
 * Date and identity formatting for the user screens.
 *
 * The design's date is `Oct 12, 2026` (US short month/day/year), which is not
 * the en-GB day-first format used elsewhere in the storefront, so it gets its
 * own formatter rather than reusing `formatDate`. Formatting in UTC keeps the
 * server-rendered date and the browser's date identical; a locale-timezone
 * conversion could disagree across the hydration boundary.
 */

/** The "never signed in" copy for a nullable `lastLogin`. */
export function formatLastLogin(value: string | null): string {
	return value ? formatUserDate(value) : "Never";
}

/** A missing current-role profile must not leave an account's identity blank. */
export function displayName(user: Pick<UserSummary, "name" | "email">): string {
	return user.name?.trim() || user.email.split("@")[0] || user.email;
}

/**
 * Up to two initials for the avatar. Falls back to the email when the name is
 * blank, and to `?` when neither has a usable character, so the avatar never
 * renders an empty circle.
 */
export function userInitials(name: string | null, email: string): string {
	const source = displayName({ name, email }).trim();

	if (!source) {
		return "?";
	}

	const words = source.split(/\s+/).filter(Boolean);

	if (words.length >= 2) {
		return `${words[0][0]}${words[1][0]}`.toUpperCase();
	}

	if (!name?.trim() || source.includes("@")) {
		return source[0].toUpperCase();
	}

	return source.slice(0, 2).toUpperCase();
}
