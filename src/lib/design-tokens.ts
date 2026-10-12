
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

	"--content-max-width": `${layout.contentMaxWidth}px`,
	"--page-padding": `${layout.pagePadding}px`,
	"--section-padding-y": `${layout.sectionPaddingY}px`,
	"--header-height": `${layout.headerHeight}px`,
	"--hero-min-height": `${layout.heroMinHeight}px`,
} satisfies Record<`--${string}`, string>;

export const designTokenCssVariables = cssVariableValues as CSSProperties;