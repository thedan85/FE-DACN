const formatter = new Intl.DateTimeFormat("en-US", {
	month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});

/** Locale-stable admin date; accepts nullable display timestamps. */
export function formatAdminDate(value: string | null | undefined): string {
	if (!value) return "—";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "—" : formatter.format(date);
}
