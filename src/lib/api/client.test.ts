import { afterEach, expect, it, vi } from "vitest";

import { apiFetch } from "./client";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

function stubFetch() {
	const fetch = vi.fn().mockResolvedValue(
		new Response("{}", {
			headers: { "Content-Type": "application/json" },
		}),
	);
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

it("keeps no-store for uncached requests", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch();

	await apiFetch("products");

	expect(fetch.mock.calls[0][1].cache).toBe("no-store");
});

it("lets revalidate opt into the Next data cache", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = stubFetch();

	await apiFetch("products", { next: { revalidate: 30 } });

	const init = fetch.mock.calls[0][1];
	expect(init.next).toEqual({ revalidate: 30 });
	expect(init.cache).not.toBe("no-store");
});
