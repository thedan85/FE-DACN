import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { createVietQrPayment } from "./payments.api";

vi.mock("@/features/auth/session", () => ({
	getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
}));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

const response = {
	qrUrl: "https://img.vietqr.io/image/VCB-123-compact2.png?amount=100000",
	bankId: "VCB",
	accountNo: "123",
	accountName: "AQUARIUM STORE",
	amount: 100000,
	addInfo: "ORD 1",
};

it("requests the customer's VietQR payment", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: response,
	})));
	vi.stubGlobal("fetch", fetch);

	const result = await createVietQrPayment("ORD 1");

	expect(result).toEqual(response);
	expect(String(fetch.mock.calls[0][0])).toBe(
		"http://localhost:8080/api/v1/payments/vietqr/ORD%201",
	);
	expect(fetch.mock.calls[0][1].method).toBe("POST");
	expect(fetch.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer test-token");
});

it("rejects a malformed QR response", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8080/api/v1");
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
		code: 200, message: "OK", data: { qrUrl: "not-a-url" },
	}))));

	await expect(createVietQrPayment("ORD 1")).rejects.toBeInstanceOf(ApiError);
});
