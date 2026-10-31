import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { RegisterForm } from "@/features/auth/storefront/components/register-form";

export const metadata: Metadata = {
	title: "Create Account",
};

export default function RegisterPage() {
	return (
		<AuthLayout
			eyebrow="AQUARIUM STORE"
			headline="Start your aquarium journey."
			description="Create an account to explore aquascaping supplies, livestock, and everyday care."
		>
			<RegisterForm />
		</AuthLayout>
	);
}
