import { expect, it } from "vitest";

import { toApiPage } from "./pagination";

it("converts the 1-based URL page to the API's 0-based index", () => {
	expect(toApiPage(1)).toBe(0);
	expect(toApiPage(2)).toBe(1);
});

it("never sends a negative page", () => {
	expect(toApiPage(0)).toBe(0);
	expect(toApiPage(-5)).toBe(0);
});
