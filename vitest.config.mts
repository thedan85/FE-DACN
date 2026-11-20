import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
	test: {
		environment: "jsdom",
		include: ["src/**/*.test.{ts,tsx}"],
		// 779 jsdom files on a loaded machine exceed the 5s default; heavy
		// admin views already opt into 15s individually.
		testTimeout: 15000,
	},
});
