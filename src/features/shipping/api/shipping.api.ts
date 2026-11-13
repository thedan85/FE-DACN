import { z } from "zod";

import { ApiError, apiFetch } from "@/lib/api/client";
import { createApiResponseSchema } from "@/lib/api/schema";

const GhnOptionSchema = z.object({
	id: z.number().int(),
	name: z.string(),
});
const GhnOptionListSchema = createApiResponseSchema(z.array(GhnOptionSchema));

export type GhnOption = z.infer<typeof GhnOptionSchema>;

export async function getGhnProvinces(): Promise<GhnOption[]> {
	const payload = await apiFetch<unknown>("shipping/ghn/provinces");
	const parsed = GhnOptionListSchema.safeParse(payload);
	if (!parsed.success) {
		throw new ApiError("The province response did not match the expected contract.", 500, payload);
	}
	return parsed.data.data;
}

export async function getGhnWards(provinceId: number): Promise<GhnOption[]> {
	const payload = await apiFetch<unknown>(
		`shipping/ghn/wards?provinceId=${encodeURIComponent(provinceId)}`,
	);
	const parsed = GhnOptionListSchema.safeParse(payload);
	if (!parsed.success) {
		throw new ApiError("The ward response did not match the expected contract.", 500, payload);
	}
	return parsed.data.data;
}
