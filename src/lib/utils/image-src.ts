/**
 * Gate for catalog image URLs before they reach `next/image`.
 *
 * `next.config.ts` allows one remote origin — `https://res.cloudinary.com` —
 * under one cloud path, `/ibk3z2nt/`. A catalog URL is untrusted response data,
 * so passing it straight to `<Image>` makes the optimizer fetch whatever origin
 * the backend (or a tampered response) supplied. This check mirrors that
 * remotePattern exactly: local assets stay local, and remote sources must be
 * that one canonical HTTPS origin. It never changes the allowlist, it only
 * decides whether a URL is eligible for it.
 *
 * Local paths are accepted because Next's default loader optimises any single
 * slash path. Protocol-relative and backslash forms are not local paths — some
 * parsers read them as a host — so they are refused.
 */

const CLOUDINARY_PREFIX = "https://res.cloudinary.com/ibk3z2nt/";

export function isOptimizableImageUrl(
	url: string | null | undefined,
): url is string {
	if (typeof url !== "string" || url.length === 0) {
		return false;
	}

	// Literal whitespace or a backslash is never part of a canonical web URL.
	// Refusing it here keeps `new URL()` from silently normalising a smuggled
	// origin or path into one that appears to match.
	if (/[\s\\]/.test(url)) {
		return false;
	}

	if (url.startsWith("/")) {
		return !url.startsWith("//");
	}

	// The raw prefix does more than a parsed hostname check: it rejects embedded
	// credentials, an upper-case scheme/host and an explicit :443 before URL
	// parsing normalises those away.
	if (!url.startsWith(CLOUDINARY_PREFIX)) {
		return false;
	}

	let parsed: URL;

	try {
		parsed = new URL(url);
	} catch {
		return false;
	}

	return (
		parsed.protocol === "https:" &&
		parsed.hostname === "res.cloudinary.com" &&
		parsed.port === "" &&
		parsed.username === "" &&
		parsed.password === "" &&
		parsed.pathname.startsWith("/ibk3z2nt/")
	);
}
