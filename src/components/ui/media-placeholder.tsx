import type { ReactNode } from "react";

import styles from "./media-placeholder.module.css";

type MediaPlaceholderProps = {
	/**
	 * Element shown above the text. Defaults to a built-in inline-SVG image
	 * glyph so the component needs no icon dependency and makes **no network
	 * request**. Pass any `@ant-design/icons` element (e.g.
	 * `<PictureOutlined />`) or custom markup to restyle it.
	 */
	icon?: ReactNode;
	/** Optional label under the icon; nothing is rendered when omitted. */
	text?: ReactNode;
	/** Extra class for layout/color overrides (colors come from tokens). */
	className?: string;
	/**
	 * Accessible name for the graphic. Defaults to `"Image unavailable"`.
	 * Pass `""` to mark the placeholder purely decorative (`aria-hidden`),
	 * e.g. when adjacent text already describes the item.
	 */
	label?: string;
};

/**
 * Generic "there is no image here" box (decision D17).
 *
 * Fills its parent's box (`width/height: 100%` with a `min-height` floor so
 * it still renders inside auto-height parents) and needs **no image asset
 * and no network request**. Used both when a product/variant ships no media
 * and when a real image fails to load at runtime — the two cases look
 * identical by design, so a broken image never reads as an error state.
 *
 * Domain-independent by contract (`src/components/ui/`): it knows nothing
 * about products, carts or reviews and may be reused by any feature.
 */
export function MediaPlaceholder({
	icon,
	text,
	className,
	label = "Image unavailable",
}: MediaPlaceholderProps) {
	const isDecorative = label.length === 0;
	const classes = [styles.root, className].filter(Boolean).join(" ");

	return (
		<div
			className={classes}
			{...(isDecorative
				? { "aria-hidden": true }
				: { role: "img", "aria-label": label })}
		>
			<span className={styles.icon} aria-hidden="true">
				{icon ?? <DefaultImageIcon />}
			</span>

			{text != null && <span className={styles.text}>{text}</span>}
		</div>
	);
}

/** Fallback glyph — inline SVG, so no icon package is required to render it. */
function DefaultImageIcon() {
	return (
		<svg
			width="1em"
			height="1em"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			focusable="false"
		>
			<rect x="3" y="5" width="18" height="14" rx="2" />
			<circle cx="8.5" cy="9.5" r="1.5" />
			<path d="M3 16.5 8.5 12l4 3.5L16 12l5 4.5" />
		</svg>
	);
}
