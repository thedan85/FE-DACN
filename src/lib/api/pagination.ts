/**
 * Converts the URL's 1-based page to the API's 0-based index.
 *
 * Kept separate from every query type so no caller has to remember which
 * convention it is holding; passing a URL page straight to a list endpoint
 * would silently skip the first page.
 */
export function toApiPage(page: number): number {
	return Math.max(page - 1, 0);
}
