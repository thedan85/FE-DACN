
"use client";

import type { PropsWithChildren } from "react";
import { App, ConfigProvider, theme } from "antd";
import { designTokens } from "@/lib/design-tokens";

const { colors, typography, radius } = designTokens;

const antdTheme = {
	algorithm: theme.defaultAlgorithm,

	token: {
		colorPrimary: colors.brandTeal,
		colorInfo: colors.brandTeal,

		colorText: colors.textHeading,
		colorTextSecondary: colors.textBody,
		colorTextPlaceholder: colors.textPlaceholder,

		colorBgLayout: colors.surfacePage,
		colorBgContainer: colors.surfaceWhite,

		colorBorder: colors.borderLight,
		colorBorderSecondary: colors.borderSubtle,

		colorLink: colors.brandDeepTeal,
		colorLinkHover: colors.brandAqua,

		fontFamily: typography.fontFamily,
		fontSize: typography.bodyCompact.fontSize,
		fontSizeHeading1: typography.hero.fontSize,
		fontSizeHeading2: typography.sectionHeading.fontSize,
		fontSizeHeading3: typography.categoryHeading.fontSize,
		fontWeightStrong: typography.weight.bold,

		lineHeight: typography.bodyCompact.lineHeight / typography.bodyCompact.fontSize,
		lineHeightHeading1: typography.hero.lineHeight / typography.hero.fontSize,
		lineHeightHeading2:
			typography.sectionHeading.lineHeight / typography.sectionHeading.fontSize,
		lineHeightHeading3:
			typography.categoryHeading.lineHeight / typography.categoryHeading.fontSize,

		borderRadius: radius.icon,
		controlHeight: 44,
	},

	components: {
		Button: {
			borderRadius: radius.pill,
			controlHeight: 44,
			fontWeight: typography.weight.semibold,
			primaryShadow: "none",
		},

		Card: {
			borderRadiusLG: radius.card,
		},

		Input: {
			activeShadow: `0 0 0 2px ${colors.brandTeal}33`,
		},

		Select: {
			activeOutlineColor: `${colors.brandTeal}33`,
		},
	},
};

export default function Providers({ children }: PropsWithChildren) {
	return (
		<ConfigProvider theme={antdTheme}>
			<App>{children}</App>
		</ConfigProvider>
	);
}