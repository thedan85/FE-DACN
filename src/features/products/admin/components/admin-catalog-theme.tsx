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
					// The design's primary hover is `#1A5650`, the same hex the sidebar
					// uses for its active row — referenced rather than re-declared, the
					// way `StatusPill` borrows `avatarSurface` for Active.
					colorPrimaryHover: admin.sidebarActiveSurface,
					colorLink: designTokens.colors.brandDeepTeal,
					colorText: admin.panelTextStrong,
					colorTextSecondary: admin.panelTextMuted,
					colorBorder: admin.panelBorder,
					colorBorderSecondary: admin.panelBorder,
					// antd derives a focus ring from the primary when this is unset,
					// and on this theme that measured as `rgb(88,133,125)` — not the
					// design's teal. `colorPrimaryBorder` is what the 3px outline on
					// buttons and Segmented is built from (`genFocusOutline`).
					colorPrimaryBorder: admin.focusRing,
					// Disabled controls, in the design's green-tinted neutrals rather
					// than antd's `rgba(0,0,0,…)` greys.
					colorBgContainerDisabled: admin.disabledSurface,
					colorTextDisabled: admin.panelTextMuted,
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
					// The focus ring on text inputs and selects does not follow
					// `token.colorPrimaryBorder` (buttons and Segmented do). Their active
					// outline is built from their *own* component tokens:
					// `Input.activeBorderColor` defaults to `colorPrimary` and
					// `Select.activeOutlineColor` to `controlOutline`, neither of which
					// this scoped theme sets — so left alone they resolve against the
					// **global** storefront theme, measured as `#1BC5BD33` on inputs.
					// These two component tokens are what actually bite; a themed
					// `controlOutline` would not, because both components now override it.
					Input: {
						activeBorderColor: admin.focusRing,
						activeShadow: `0 0 0 2px ${admin.focusRing}`,
					},
					Select: {
						activeBorderColor: admin.focusRing,
						activeOutlineColor: admin.focusRing,
					},
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
					Listy: {
						// Row rhythm for the attribute list. These are Listy's own
						// tokens, so no CSS rule has to out-rank antd's
						// `:where()`-wrapped `.ant-listy-item` chain for the same values.
						itemPaddingBlock: 8,
						itemPaddingInline: 0,
					},
				},
			}}
		>
			{children}
		</ConfigProvider>
	);
}
