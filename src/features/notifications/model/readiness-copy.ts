/** One wording source for the bell preview and the full inbox page. */
export const CONNECTING_NOTE = "Connecting to live updates…";
export const DEGRADED_NOTE =
	"Live updates are degraded; showing the latest saved notifications.";
export const REST_ONLY_NOTE =
	"Live updates are unavailable; showing the latest saved notifications.";

export function readinessNote(status: string): string | null {
	if (status === "live") return null;
	if (status === "connecting") return CONNECTING_NOTE;
	if (status === "degraded") return DEGRADED_NOTE;
	return REST_ONLY_NOTE;
}
