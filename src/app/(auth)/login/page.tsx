import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
	title: "Sign In",
};

export default function LoginPage() {
	return (
		<AuthLayout
			eyebrow="AQUARIUM STORE"
			headline="Modern care for living water."
			description="A calm, focused entry point for your aquascaping and livestock workflow."
		>
			<LoginForm />
		</AuthLayout>
	);
}
