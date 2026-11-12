import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicEnv, getRealtimePublicEnv } from "./env";

const API = "http://localhost:8080/api/v1";

function configure(values: Record<string, string | undefined>) {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", values.NEXT_PUBLIC_API_BASE_URL ?? API);
	vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", values.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
	vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", values.NEXT_PUBLIC_SUPABASE_URL);
	vi.stubEnv(
		"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	);
}

describe("realtime public env", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("allows both Supabase values to be absent", () => {
		configure({});

		expect(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
		expect(getRealtimePublicEnv()).toBeNull();
	});

	it("rejects a partial configuration with an actionable message", () => {
		configure({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" });

		expect(() => getRealtimePublicEnv()).toThrow(/both .*URL .*PUBLISHABLE_KEY/i);
	});

	it("rejects an invalid or non-loopback plain-http URL", () => {
		configure({
			NEXT_PUBLIC_SUPABASE_URL: "http://project.supabase.co",
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk",
		});

		expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
	});

	it("accepts https and loopback http with both values", () => {
		configure({
			NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk",
		});
		expect(getRealtimePublicEnv()).toEqual({
			url: "https://project.supabase.co",
			publishableKey: "pk",
		});

		for (const url of [
			"http://localhost:54321",
			"http://127.0.0.1:54321",
			"http://[::1]:54321",
		]) {
			configure({
				NEXT_PUBLIC_SUPABASE_URL: url,
				NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pk",
			});
			expect(getRealtimePublicEnv()?.url).toBe(url);
		}
	});

	it.each([
		{ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" },
		{ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key-not-for-errors" },
		{
			NEXT_PUBLIC_SUPABASE_URL: " ",
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key-not-for-errors",
		},
		{
			NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " ",
		},
	])("rejects incomplete public config without echoing values: %j", (values) => {
		configure(values);

		for (const readEnv of [getPublicEnv, getRealtimePublicEnv]) {
			expect(readEnv).toThrow(/both .*URL .*PUBLISHABLE_KEY/i);
			expect(readEnv).not.toThrow(/key-not-for-errors|project\.supabase\.co/);
		}
	});

	it("treats two blank values as disabled", () => {
		configure({
			NEXT_PUBLIC_SUPABASE_URL: " ",
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "\t",
		});

		expect(getPublicEnv().NEXT_PUBLIC_API_BASE_URL).toBe(API);
		expect(getRealtimePublicEnv()).toBeNull();
	});

	it("trims both public values", () => {
		configure({
			NEXT_PUBLIC_SUPABASE_URL: " https://project.supabase.co ",
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " pk ",
		});

		expect(getRealtimePublicEnv()).toEqual({
			url: "https://project.supabase.co",
			publishableKey: "pk",
		});
	});

	it.each([
		"not-a-url",
		"https:project.supabase.co",
		"ftp://project.supabase.co",
		"http://localhost.attacker.test:54321",
		"http://127.0.0.1.attacker.test:54321",
		"http://127.1:54321",
		"http://2130706433:54321",
		"http://0x7f000001:54321",
		"http://[::ffff:127.0.0.1]:54321",
		"https://project.supabase.co/rest/v1",
		"https://project.supabase.co?key=do-not-echo",
		"https://user:do-not-echo@project.supabase.co",
	])("rejects a malformed, non-origin, or non-exact loopback URL: %s", (url) => {
		configure({
			NEXT_PUBLIC_SUPABASE_URL: url,
			NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key-not-for-errors",
		});

		expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL.*https/i);
		expect(() => getPublicEnv()).not.toThrow(/do-not-echo|key-not-for-errors/);
	});
});
