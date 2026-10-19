
import { z } from "zod";

const publicEnvSchema = z.object({
	NEXT_PUBLIC_API_BASE_URL: z
		.url("NEXT_PUBLIC_API_BASE_URL must be a valid URL")
		.refine(
			(value) => ["http:", "https:"].includes(new URL(value).protocol),
			"NEXT_PUBLIC_API_BASE_URL must use HTTP or HTTPS",
		),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
	const result = publicEnvSchema.safeParse({
		NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
	});

	if (!result.success) {
		const details = result.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join("; ");

		throw new Error(`Invalid public environment configuration: ${details}`);
	}

	return result.data;
}