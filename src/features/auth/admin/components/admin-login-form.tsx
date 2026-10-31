"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ConfigProvider, Flex, Form, Input, Typography } from "antd";
import { designTokens } from "@/lib/design-tokens";
import { useAuthStore } from "@/stores/auth-store";
import { getAuthErrorMessage, getMe, login } from "../../api/auth.api";
import { validateEmail, validateRequired } from "../../model/validation";
import { clearSession, setAccessToken } from "../../session";
import styles from "./admin-login-form.module.css";

type LoginValues = {
	email: string;
	password: string;
};

/**
 * The only role without portal access — the backend's own discriminator.
 * Compared case-insensitively because `GET auth/me` returns the stored code
 * verbatim (`customer`, `admin`, …), while the backend's own check is
 * `equalsIgnoreCase("CUSTOMER")`.
 */
const CUSTOMER_ROLE_CODE = "CUSTOMER";

const COMPANY_ACCOUNTS_ONLY =
	"This portal is for company accounts only. Customer accounts sign in through the storefront.";

/**
 * The login screen's own control metrics. The design's inputs are 48px tall
 * with a 12px radius on the `#CBD5E1` input border; the shared theme sets 44px,
 * a 16px radius and the lighter `#E2E8F0` border for the storefront. Scoping
 * them here keeps the storefront theme untouched (docs/antd.md: a nested
 * `ConfigProvider` around one region beats rewriting that region's CSS).
 */
const loginTheme = {
	token: {
		controlHeight: 48,
		borderRadius: designTokens.radius.control,
		colorBorder: designTokens.colors.borderInput,
		// Drives the primary button's fill and the input's focus ring. The
		// portal's primary action is the deep-teal brand colour, not the
		// storefront's aqua `colorPrimary`, and there is no Button component
		// token for the fill itself (`primaryColor` is the label colour).
		colorPrimary: designTokens.colors.brandDeepTeal,
	},
	components: {
		// Restated rather than inherited: the `token` block above is what the
		// shared theme uses to derive these, so a nested scope has to say them
		// again or antd re-derives a 14px radius from `borderRadius`.
		Button: {
			borderRadius: designTokens.radius.pill,
			controlHeight: 48,
		},
	},
};

function isCustomerAccount(roleCode: string): boolean {
	return roleCode.toUpperCase() === CUSTOMER_ROLE_CODE;
}

export function AdminLoginForm() {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);

	async function handleFinish(values: LoginValues) {
		setServerError(null);
		setPending(true);

		const email = values.email.trim();

		try {
			const data = await login({ email, password: values.password });
			setAccessToken(data.accessToken);

			const user = await getMe();

			if (isCustomerAccount(user.roleCode)) {
				// The token `auth/login` just minted is dropped locally and
				// deliberately not revoked: the refresh cookie is shared with the
				// storefront, where this account is a legitimate customer. The
				// store is reset too, so a session left over from an earlier
				// sign-in in this tab cannot keep showing an identity.
				clearSession();
				useAuthStore.setState({ user: null, status: "anonymous" });
				setServerError(COMPANY_ACCOUNTS_ONLY);
				return;
			}

			// Nothing is written to the auth store until the role check passes,
			// so a rejected or failed attempt has nothing to undo.
			useAuthStore.getState().setUser(user);
			router.replace("/admin/dashboard");
		} catch (submitError) {
			clearSession();
			setServerError(getAuthErrorMessage(submitError));
		} finally {
			setPending(false);
		}
	}

	return (
		<ConfigProvider theme={loginTheme}>
			<Form<LoginValues>
				className={styles.form}
				layout="vertical"
				requiredMark={false}
				onFinish={handleFinish}
				onValuesChange={() => setServerError(null)}
				classNames={{ label: styles.visuallyHidden }}
			>
				<header className={styles.header}>
					<Typography.Title className={styles.title} level={1}>
						Store admin sign in
					</Typography.Title>
					<Typography.Paragraph className={styles.subtitle}>
						Sign in with your company account to manage the store.
					</Typography.Paragraph>
				</header>

				<Flex gap={designTokens.spacing[3]} vertical>
					<Form.Item
						name="email"
						label="Email address"
						rules={[
							{
								validator: (_, value: string | undefined) => {
									const message = validateEmail(String(value ?? ""));

									return message
										? Promise.reject(new Error(message))
										: Promise.resolve();
								},
							},
						]}
					>
						<Input
							name="email"
							type="email"
							placeholder="Email address"
							autoComplete="email"
							aria-label="Email address"
						/>
					</Form.Item>

					<Form.Item
						name="password"
						label="Password"
						rules={[
							{
								validator: (_, value: string | undefined) => {
									const message = validateRequired(
										String(value ?? ""),
										"Password",
									);

									return message
										? Promise.reject(new Error(message))
										: Promise.resolve();
								},
							},
						]}
					>
						<Input.Password
							name="password"
							placeholder="Password"
							autoComplete="current-password"
							aria-label="Password"
						/>
					</Form.Item>
				</Flex>

				{serverError != null && (
					<Alert
						className={styles.error}
						showIcon={false}
						title={serverError}
						type="error"
					/>
				)}

				<Button
					block
					disabled={pending}
					htmlType="submit"
					loading={pending}
					type="primary"
				>
					Sign In
				</Button>
			</Form>
		</ConfigProvider>
	);
}
