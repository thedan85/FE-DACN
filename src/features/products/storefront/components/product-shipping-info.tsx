import Link from "next/link";

import styles from "./product-shipping-info.module.css";

const SHIPPING_POINTS = [
	"Orders are packed within 1–2 business days. Livestock ships express and is in transit for 24–48 hours; dry goods arrive in 3–5 business days.",
	"Each animal is bagged with oxygen, cushioned, and packed in a climate-controlled insulated box with heat or cold packs as needed. Every live order includes a live-arrival guarantee.",
	"If an order arrives damaged or dead, contact us within 24 hours of delivery with photos of the packaging and animals, and we will arrange a replacement or refund under our live-arrival policy.",
	"Once your order ships, we email a tracking link. Signed-in customers can also follow the latest order status from their account.",
] as const;

/**
 * Shipping Info tab. The copy mirrors the storefront FAQ claims (packing
 * windows, live-arrival guarantee, tracking) rather than inventing carrier
 * names, fees or delivery dates the backend does not provide.
 */
export function ProductShippingInfo() {
	return (
		<section className={styles.root} aria-labelledby="shipping-heading">
			<h2 id="shipping-heading" className={styles.heading}>
				Shipping &amp; Delivery
			</h2>

			<p className={styles.intro}>
				Live fish and plants need careful handling, so every order is
				packed for the trip before it leaves us.
			</p>

			<ul className={styles.list}>
				{SHIPPING_POINTS.map((point) => (
					<li key={point}>
						{point}
					</li>
				))}
			</ul>

			<p className={styles.more}>
				<Link className={styles.link} href="/faq">
					Read all shipping answers in our FAQ
				</Link>
			</p>
		</section>
	);
}
