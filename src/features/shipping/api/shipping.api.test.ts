import { afterEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { getGhnProvinces, getGhnWards } from "./shipping.api";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

it("loads active provinces from the public envelope", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: [{ id: 1000001, name: "Hồ Chí Minh" }],
	})));
	vi.stubGlobal("fetch", fetch);

	const result = await getGhnProvinces();

	expect(result).toEqual([{ id: 1000001, name: "Hồ Chí Minh" }]);
	expect(String(fetch.mock.calls[0][0])).toBe(
		"http://localhost:8080/api/v1/shipping/ghn/provinces",
	);
});

it("encodes the province id when loading wards", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: [{ id: 10, name: "Phường Chợ Quán" }],
	})));
	vi.stubGlobal("fetch", fetch);

	await getGhnWards(1000001);

	expect(String(fetch.mock.calls[0][0])).toBe(
		"http://localhost:8080/api/v1/shipping/ghn/wards?provinceId=1000001",
	);
});

it("rejects a malformed envelope", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, data: [],
	}))));

	await expect(getGhnProvinces()).rejects.toBeInstanceOf(ApiError);
});
