"use client";

import type { ReactNode } from "react";
import { ConfigProvider } from "antd";

import { designTokens } from "@/lib/design-tokens";

const { admin } = designTokens.colors;

/**
 * Theme for the admin catalog surfaces only.
 *
 * The storefront's global theme is built for a customer-facing shop: a bright
 * teal primary (`#1BC5BD`), 44px controls and 16px radii. The admin design is a
 * denser product — 38px controls, 6px radii, and the deep-teal `#115E59` as its
 * primary — so this scopes those values to the catalog screens rather than
 * changing the theme every other page depends on (the ladder in `docs/antd.md`:
 * a component token, not a global rewrite).
 *
 * Everything maps to `designTokens`, so a colour cannot drift between the CSS
 * modules and the antd theme.
 */
export function AdminCatalogTheme({ children }: { children: ReactNode }) {
	return (
		<ConfigProvider
			theme={{
				token: {
					colorPrimary: designTokens.colors.brandDeepTeal,
					colorLink: designTokens.colors.brandDeepTeal,
					colorText: admin.panelTextStrong,
					colorTextSecondary: admin.panelTextMuted,
					colorBorder: admin.panelBorder,
					colorBorderSecondary: admin.panelBorder,
					// The create form's draft notice is a pale blue band, not the
					// storefront's teal info tint; these three tokens are what carry it,
					// so the colour lives in the theme rather than an override rule.
					colorInfoBg: admin.noticeSurface,
					colorInfoBorder: admin.noticeBorder,
					colorInfo: admin.noticeText,
					// 38px controls and a 6px radius are the design's values; the
					// global theme's 44px/16px would read as a storefront control.
					controlHeight: 38,
					borderRadius: 6,
					fontSize: 13,
				},
				components: {
					Table: {
						headerBg: admin.panelSurfaceSubtle,
						headerColor: admin.panelTextMuted,
						borderColor: admin.panelBorder,
						rowHoverBg: admin.panelSurfaceSubtle,
						// Row height is 2 × block padding + 45px of content/borders, so
						// 15.5 lands on the design's 76px exactly (16 gives 77, 14 gives 73).
						cellPaddingBlock: 15.5,
						cellPaddingInline: 16,
					},
					Button: {
						// The global theme sets `Button.controlHeight: 44` and a pill
						// radius explicitly, so the scoped `token.controlHeight` above
						// does not reach buttons — these two have to be restated here
						// or the admin buttons render as storefront pills.
						controlHeight: 38,
						borderRadius: 6,
						borderRadiusSM: 6,
						fontWeight: 400,
						primaryShadow: "none",
					},
					Card: {
						borderRadiusLG: 10,
					},
					Tag: {
						borderRadiusSM: 4,
					},
				},
			}}
		>
			{children}
		</ConfigProvider>
	);
}
