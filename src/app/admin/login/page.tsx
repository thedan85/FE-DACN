import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AdminLoginForm } from "@/features/auth/admin/components/admin-login-form";

export const metadata: Metadata = {
	title: "Admin Sign In",
};

/**
 * Company-account sign-in. Sits outside the `(shell)` route group on purpose:
 * the portal shell (and, later, its guard) must never wrap the login screen.
 * The right-hand image panel is the same Figma frame as the storefront login.
 */
export default function AdminLoginPage() {
	return (
		<AuthLayout
			eyebrow="AQUARIUM STORE"
			headline="Modern care for living water."
			description="A calm, focused entry point for your aquascaping and livestock workflow."
		>
			<AdminLoginForm />
		</AuthLayout>
	);
}
