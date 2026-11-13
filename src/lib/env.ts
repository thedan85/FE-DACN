
import { z } from "zod";

function isValidSupabaseUrl(value: string): boolean {
	if (!/^https?:\/\//i.test(value)) return false;

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	const loopback = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/?$/i.test(value);
	const allowedScheme =
		url.protocol === "https:" || (url.protocol === "http:" && loopback);

	return (
		allowedScheme &&
		!url.username &&
		!url.password &&
		(url.pathname === "" || url.pathname === "/") &&
		!url.search &&
		!url.hash
	);
}

const publicEnvSchema = z.object({
	NEXT_PUBLIC_API_BASE_URL: z
		.url("NEXT_PUBLIC_API_BASE_URL must be a valid URL")
		.refine(
			(value) => ["http:", "https:"].includes(new URL(value).protocol),
			"NEXT_PUBLIC_API_BASE_URL must use HTTP or HTTPS",
		),
	NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
	NEXT_PUBLIC_SUPABASE_URL: z
		.string()
		.trim()
		.optional()
		.refine(
			(value) => !value || isValidSupabaseUrl(value),
			"NEXT_PUBLIC_SUPABASE_URL must be an https project origin without credentials, path, query, or fragment (http is allowed only for localhost, 127.0.0.1, or [::1] development)",
		),
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().optional(),
}).refine(
	(env) => Boolean(env.NEXT_PUBLIC_SUPABASE_URL) === Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
	"Set both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or leave both unset.",
);

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
	const result = publicEnvSchema.safeParse({
		NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
		NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	});

	if (!result.success) {
		const details = result.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join("; ");

		throw new Error(`Invalid public environment configuration: ${details}`);
	}

	return result.data;
}

export function getRealtimePublicEnv(): { url: string; publishableKey: string } | null {
	const {
		NEXT_PUBLIC_SUPABASE_URL: url,
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
	} = getPublicEnv();

	return url && publishableKey ? { url, publishableKey } : null;
}
