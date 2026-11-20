import { describe, expect, it } from "vitest";

import { isOptimizableImageUrl } from "./image-src";

/**
 * The gate in front of every `next/image` fed by the catalog API. It must
 * accept exactly what `next.config.ts` can optimise (plus local assets) and
 * refuse anything the optimizer would fetch from an unintended origin.
 */

const allowed =
	"https://res.cloudinary.com/ibk3z2nt/image/upload/v1/shrimp.png";

describe("isOptimizableImageUrl", () => {
	it("accepts the configured Cloudinary cloud", () => {
		expect(isOptimizableImageUrl(allowed)).toBe(true);
	});

	it("accepts a Cloudinary URL with a transformation query", () => {
		expect(
			isOptimizableImageUrl(`${allowed}?w=400&q=auto`),
		).toBe(true);
	});

	it("accepts a project-relative asset", () => {
		expect(isOptimizableImageUrl("/images/products/anubias.png")).toBe(true);
	});

	it("rejects another Cloudinary cloud", () => {
		expect(
			isOptimizableImageUrl("https://res.cloudinary.com/other/image/upload/a.png"),
		).toBe(false);
	});

	it("rejects a different host", () => {
		expect(isOptimizableImageUrl("https://cdn.example.com/a.png")).toBe(false);
	});

	it("rejects http", () => {
		expect(
			isOptimizableImageUrl("http://res.cloudinary.com/ibk3z2nt/a.png"),
		).toBe(false);
	});

	it("rejects embedded credentials", () => {
		expect(
			isOptimizableImageUrl(
				"https://user:pass@res.cloudinary.com/ibk3z2nt/a.png",
			),
		).toBe(false);
	});

	it("rejects a noncanonical scheme or hostname", () => {
		expect(
			isOptimizableImageUrl(
				"HTTPS://RES.CLOUDINARY.COM/ibk3z2nt/a.png",
			),
		).toBe(false);
	});

	it("rejects an explicit default port", () => {
		expect(
			isOptimizableImageUrl(
				"https://res.cloudinary.com:443/ibk3z2nt/a.png",
			),
		).toBe(false);
	});

	it("rejects a protocol-relative URL", () => {
		expect(
			isOptimizableImageUrl("//res.cloudinary.com/ibk3z2nt/a.png"),
		).toBe(false);
	});

	it("rejects a backslash host separator", () => {
		expect(
			isOptimizableImageUrl("/\\res.cloudinary.com/ibk3z2nt/a.png"),
		).toBe(false);
	});

	it("rejects traversal out of the cloud path", () => {
		expect(
			isOptimizableImageUrl(
				"https://res.cloudinary.com/ibk3z2nt/../other/a.png",
			),
		).toBe(false);
	});

	it("rejects the bare cloud path without a trailing segment", () => {
		expect(
			isOptimizableImageUrl("https://res.cloudinary.com/ibk3z2nt"),
		).toBe(false);
	});

	it("rejects non-URL schemes and malformed or empty input", () => {
		expect(isOptimizableImageUrl("javascript:alert(1)")).toBe(false);
		expect(isOptimizableImageUrl("data:image/png;base64,AAA")).toBe(false);
		expect(isOptimizableImageUrl("")).toBe(false);
		expect(isOptimizableImageUrl(null)).toBe(false);
		expect(isOptimizableImageUrl(undefined)).toBe(false);
	});

	it("rejects surrounding whitespace", () => {
		expect(isOptimizableImageUrl(` ${allowed} `)).toBe(false);
	});
});
