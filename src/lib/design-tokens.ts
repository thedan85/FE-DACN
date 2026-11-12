
import type { CSSProperties } from "react";

const colors = {
	brandTeal: "#1BC5BD",
	brandAqua: "#2DD4BF",
	brandAquaLight: "#5EEAD4",
	brandDeepTeal: "#115E59",
	brandDarkTeal: "#0E443E",

	surfacePage: "#F2F7F5",
	surfaceWhite: "#FFFFFF",
	surfaceIcon: "#EDF6F4",
	surfaceDark: "#0B2926",
	surfaceFooter: "#071F1D",
	surfaceMetric: "#123631",
	surfaceBadge: "#0F172A",

	textHeading: "#0F172A",
	textNavigation: "#334155",
	textBody: "#475569",
	textMuted: "#64748B",
	textPlaceholder: "#94A3B8",
	textLight: "#CBD5E1",
	textCardLight: "#E2E8F0",
	textWhite: "#FFFFFF",

	borderSubtle: "rgba(226, 232, 240, 0.6)",
	borderLight: "#E2E8F0",
	borderInput: "#CBD5E1",
	borderHeader: "#F1F5F9",
	borderFooter: "rgba(19, 78, 74, 0.6)",

	overlayButton: "rgba(255, 255, 255, 0.05)",
	overlayButtonBorder: "rgba(255, 255, 255, 0.2)",
	overlayButtonBorderHover: "rgba(255, 255, 255, 0.25)",

	overlayImageDarkStart: "rgba(9, 38, 35, 0.25)",
	overlayImageDarkEnd: "rgba(9, 38, 35, 0.95)",

	danger: "#B42318",

	// Admin portal surfaces (Figma: Admin Dashboard frame 5445-2495).
	admin: {
		sidebarSurface: "#0C3532",
		sidebarActiveSurface: "#1A5650",
		sidebarText: "#B8CDCA",
		sidebarSubtitle: "#8AB6AE",
		sidebarDivider: "#28504B",
		panelBorder: "#DFE8E4",
		panelTextMuted: "#687D7B",
		panelTextStrong: "#142D2D",
		avatarSurface: "#E9F5F1",

		// Catalog surfaces (Figma: Products & Variants board). The neutrals are
		// green-tinted on purpose — a pure grey reads cold beside the teal
		// sidebar, so even white and near-white carries a trace of it.
		//
		// Only the values the catalog screens actually render live here. The
		// ticket's proposed `panelSurfaceTint` (`#E9F5F1`) was not added as a
		// second name for a hex `avatarSurface` already carries — the status pill
		// borrows that one directly, exactly as the Active tone does. Likewise
		// `controlOn` and `borderStrong` were proposed for a checkbox and a
		// control border the catalog does not render yet; naming colours nothing
		// draws is the dead-token case this file keeps out.
		//
		// Two near-duplicates ARE both kept, deliberately: `panelSurfaceSubtle`
		// (`#F6F9F7`, the tint *on* a card) against `surfacePage` (`#F2F7F5`, the
		// page behind it) — one step apart because a card has to read as raised.
		panelSurfaceSubtle: "#F6F9F7", // table header, expanded variant row

		// Disabled controls. antd's defaults are neutral greys (`rgba(0,0,0,.04)`
		// fill, `rgba(0,0,0,.25)` text), which read as "off-brand" beside the
		// green-tinted neutrals; the design's disabled control is `#E5ECE9` on
		// `#687D7B`, so both are supplied to the scoped theme. Consumed by the
		// antd theme only, hence no matching custom property (see `focusRing`).
		disabledSurface: "#E5ECE9",

		// The keyboard focus ring. antd derives `colorPrimaryBorder` from the
		// primary when it is not set, which on this theme landed on
		// `rgb(88,133,125)` — measured in the browser — while the design's ring is
		// this teal. Text inputs and selects ignore that token entirely and build
		// their ring from their own component tokens, which is why
		// `admin-catalog-theme.tsx` also sets `Input`/`Select` focus values.
		//
		// Like `disabledSurface` above, this is consumed by the *antd theme*
		// (`admin-catalog-theme.tsx`), not by a CSS module, so it is deliberately
		// not emitted as a `--color-admin-*` custom property — a variable nothing
		// reads is a value with no consumer.
		focusRing: "#2A9D8F",

		// The create form's draft notice (Figma: admin-add-product banner).
		noticeSurface: "#EDF5FA",
		noticeBorder: "#D6E6F0",
		noticeText: "#437F9B",

		// Status tones. Draft and Low stock share the warning pair; Archived and
		// Deleted share the danger pair, exactly as the design board defines them.
		// Active reuses `avatarSurface` and `brandDeepTeal` rather than aliasing
		// the same two hexes under new names — the module comments say so.
		statusWarningSurface: "#FCF3E3",
		statusWarningText: "#97661C",
		statusDangerSurface: "#FBEFEE",
		statusDangerText: "#BC5A53",

		// Dashboard surfaces (Figma: Admin Dashboard frame 5445-2495). The chart
		// line and area live here because the SVG reads them through CSS custom
		// properties; the donut palette is read in TypeScript and has no CSS
		// consumer, so it is typed here without a duplicated variable below.
		dashboardChartLine: "#2A9D8F",
		dashboardChartArea: "#E9F5F1",

		// Order-status tones from the recent-orders badges and the donut legend.
		orderStatusPendingSurface: "#FBF3E3",
		orderStatusPendingText: "#97661C",
		orderStatusConfirmedSurface: "#E9F5F1",
		orderStatusConfirmedText: "#115E59",
		orderStatusShippingSurface: "#EDF4F8",
		orderStatusShippingText: "#42768A",
		orderStatusCompletedSurface: "#ECF5EE",
		orderStatusCompletedText: "#39785B",
		orderStatusCancelledSurface: "#FAEFED",
		orderStatusCancelledText: "#A75D58",

		donutCompleted: "#115E59",
		donutShipping: "#5D9DA6",
		donutConfirmed: "#77BCAF",
		donutPending: "#D7B776",
		donutCancelled: "#C68B82",
	},
} as const;

const typography = {
	fontFamily: "var(--font-plus-jakarta-sans)",

	weight: {
		regular: 400,
		medium: 500,
		semibold: 600,
		bold: 700,
		extrabold: 800,
	},

	hero: {
		fontSize: 60,
		lineHeight: 60,
		letterSpacing: "-1.5px",
		fontWeight: 800,
	},
	sectionHeading: {
		fontSize: 48,
		lineHeight: 48,
		letterSpacing: "-1.2px",
		fontWeight: 800,
	},
	communityMetric: {
		fontSize: 36,
		lineHeight: 40,
		letterSpacing: "0",
		fontWeight: 800,
	},
	categoryHeading: {
		fontSize: 30,
		lineHeight: 36,
		letterSpacing: "-0.75px",
		fontWeight: 700,
	},
	cardHeading: {
		fontSize: 20,
		lineHeight: 28,
		letterSpacing: "0",
		fontWeight: 700,
	},
	body: {
		fontSize: 18,
		lineHeight: 29.25,
		letterSpacing: "0",
		fontWeight: 400,
	},
	bodyCompact: {
		fontSize: 16,
		lineHeight: 24,
		letterSpacing: "0",
		fontWeight: 400,
	},
	navigation: {
		fontSize: 15,
		lineHeight: 22.5,
		letterSpacing: "0",
		fontWeight: 500,
	},
	small: {
		fontSize: 14,
		lineHeight: 20,
		letterSpacing: "0",
		fontWeight: 400,
	},
	smallRelaxed: {
		fontSize: 14,
		lineHeight: 22.75,
		letterSpacing: "0",
		fontWeight: 400,
	},
	eyebrow: {
		fontSize: 12,
		lineHeight: 16,
		letterSpacing: "1.2px",
		fontWeight: 700,
	},
} as const;

const spacing = {
	3: 12,
	4: 16,
	6: 24,
	8: 32,
	10: 40,
	16: 64,
} as const;

const radius = {
	pill: 9999,
	card: 32,
	categoryCard: 40,
	icon: 16,
	control: 12,
} as const;

const layout = {
	contentMaxWidth: 1280,
	pagePadding: 24,
	sectionPaddingY: 96,
	headerHeight: 80,
	heroMinHeight: 580,
} as const;

export const designTokens = {
	colors,
	typography,
	spacing,
	radius,
	layout,
} as const;

/**
 * CSS custom properties are generated from the typed tokens above.
 * Use these variables in globals.css and component CSS Modules.
 */
const cssVariableValues = {
	"--color-brand-teal": colors.brandTeal,
	"--color-brand-aqua": colors.brandAqua,
	"--color-brand-aqua-light": colors.brandAquaLight,
	"--color-brand-deep-teal": colors.brandDeepTeal,
	"--color-brand-dark-teal": colors.brandDarkTeal,

	"--color-surface-page": colors.surfacePage,
	"--color-surface-white": colors.surfaceWhite,
	"--color-surface-icon": colors.surfaceIcon,
	"--color-surface-dark": colors.surfaceDark,
	"--color-surface-footer": colors.surfaceFooter,
	"--color-surface-metric": colors.surfaceMetric,
	"--color-surface-badge": colors.surfaceBadge,

	"--color-text-heading": colors.textHeading,
	"--color-text-navigation": colors.textNavigation,
	"--color-text-body": colors.textBody,
	"--color-text-muted": colors.textMuted,
	"--color-text-placeholder": colors.textPlaceholder,
	"--color-text-light": colors.textLight,
	"--color-text-card-light": colors.textCardLight,
	"--color-text-white": colors.textWhite,

	"--color-border-subtle": colors.borderSubtle,
	"--color-border-light": colors.borderLight,
	"--color-border-input": colors.borderInput,
	"--color-border-header": colors.borderHeader,
	"--color-border-footer": colors.borderFooter,

	"--overlay-button": colors.overlayButton,
	"--overlay-button-border": colors.overlayButtonBorder,
	"--overlay-button-border-hover": colors.overlayButtonBorderHover,
	"--overlay-image-dark-start": colors.overlayImageDarkStart,
	"--overlay-image-dark-end": colors.overlayImageDarkEnd,

	"--color-danger": colors.danger,

	"--color-admin-sidebar-surface": colors.admin.sidebarSurface,
	"--color-admin-sidebar-active": colors.admin.sidebarActiveSurface,
	"--color-admin-sidebar-text": colors.admin.sidebarText,
	"--color-admin-sidebar-subtitle": colors.admin.sidebarSubtitle,
	"--color-admin-sidebar-divider": colors.admin.sidebarDivider,
	"--color-admin-panel-border": colors.admin.panelBorder,
	"--color-admin-panel-text-muted": colors.admin.panelTextMuted,
	"--color-admin-panel-text-strong": colors.admin.panelTextStrong,
	"--color-admin-avatar-surface": colors.admin.avatarSurface,
	"--color-admin-panel-surface-subtle": colors.admin.panelSurfaceSubtle,
	"--color-admin-status-warning-surface": colors.admin.statusWarningSurface,
	"--color-admin-status-warning-text": colors.admin.statusWarningText,
	"--color-admin-status-danger-surface": colors.admin.statusDangerSurface,
	"--color-admin-status-danger-text": colors.admin.statusDangerText,
	"--color-admin-dashboard-chart-line": colors.admin.dashboardChartLine,
	"--color-admin-dashboard-chart-area": colors.admin.dashboardChartArea,
	"--color-admin-order-pending-surface": colors.admin.orderStatusPendingSurface,
	"--color-admin-order-pending-text": colors.admin.orderStatusPendingText,
	"--color-admin-order-confirmed-surface": colors.admin.orderStatusConfirmedSurface,
	"--color-admin-order-confirmed-text": colors.admin.orderStatusConfirmedText,
	"--color-admin-order-shipping-surface": colors.admin.orderStatusShippingSurface,
	"--color-admin-order-shipping-text": colors.admin.orderStatusShippingText,
	"--color-admin-order-completed-surface": colors.admin.orderStatusCompletedSurface,
	"--color-admin-order-completed-text": colors.admin.orderStatusCompletedText,
	"--color-admin-order-cancelled-surface": colors.admin.orderStatusCancelledSurface,
	"--color-admin-order-cancelled-text": colors.admin.orderStatusCancelledText,

	"--font-family-sans": typography.fontFamily,

	"--font-size-hero": `${typography.hero.fontSize}px`,
	"--line-height-hero": `${typography.hero.lineHeight}px`,
	"--letter-spacing-hero": typography.hero.letterSpacing,

	"--font-size-section-heading": `${typography.sectionHeading.fontSize}px`,
	"--line-height-section-heading": `${typography.sectionHeading.lineHeight}px`,
	"--letter-spacing-section-heading": typography.sectionHeading.letterSpacing,

	"--font-size-community-metric": `${typography.communityMetric.fontSize}px`,
	"--line-height-community-metric": `${typography.communityMetric.lineHeight}px`,

	"--font-size-category-heading": `${typography.categoryHeading.fontSize}px`,
	"--line-height-category-heading": `${typography.categoryHeading.lineHeight}px`,
	"--letter-spacing-category-heading": typography.categoryHeading.letterSpacing,

	"--font-size-card-heading": `${typography.cardHeading.fontSize}px`,
	"--line-height-card-heading": `${typography.cardHeading.lineHeight}px`,

	"--font-size-body": `${typography.body.fontSize}px`,
	"--line-height-body": `${typography.body.lineHeight}px`,

	"--font-size-body-compact": `${typography.bodyCompact.fontSize}px`,
	"--line-height-body-compact": `${typography.bodyCompact.lineHeight}px`,

	"--font-size-navigation": `${typography.navigation.fontSize}px`,
	"--line-height-navigation": `${typography.navigation.lineHeight}px`,

	"--font-size-small": `${typography.small.fontSize}px`,
	"--line-height-small": `${typography.small.lineHeight}px`,
	"--line-height-small-relaxed": `${typography.smallRelaxed.lineHeight}px`,

	"--font-size-eyebrow": `${typography.eyebrow.fontSize}px`,
	"--line-height-eyebrow": `${typography.eyebrow.lineHeight}px`,
	"--letter-spacing-eyebrow": typography.eyebrow.letterSpacing,

	"--space-3": `${spacing[3]}px`,
	"--space-4": `${spacing[4]}px`,
	"--space-6": `${spacing[6]}px`,
	"--space-8": `${spacing[8]}px`,
	"--space-10": `${spacing[10]}px`,
	"--space-16": `${spacing[16]}px`,

	"--radius-pill": `${radius.pill}px`,
	"--radius-card": `${radius.card}px`,
	"--radius-category-card": `${radius.categoryCard}px`,
	"--radius-icon": `${radius.icon}px`,
	"--radius-control": `${radius.control}px`,

	"--content-max-width": `${layout.contentMaxWidth}px`,
	"--page-padding": `${layout.pagePadding}px`,
	"--section-padding-y": `${layout.sectionPaddingY}px`,
	"--header-height": `${layout.headerHeight}px`,
	"--hero-min-height": `${layout.heroMinHeight}px`,
} satisfies Record<`--${string}`, string>;

export const designTokenCssVariables = cssVariableValues as CSSProperties;