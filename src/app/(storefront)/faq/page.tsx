import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import styles from "../info-page.module.css";

export const metadata: Metadata = {
	title: "FAQ",
	description:
		"Answers about aquarium orders, livestock shipping, returns, and account support.",
};

const faqGroups = [
	{
		title: "Orders & shipping",
		items: [
			{
				question: "How long does delivery take?",
				answer:
					"Orders are packed within 1–2 business days. Dry goods arrive in 3–5 business days, while livestock ships express with 24–48 hours in transit.",
			},
			{
				question: "Do you ship live fish and plants?",
				answer:
					"Yes. Livestock ships in climate-controlled packaging with heat or cold packs as needed. Every live order includes a live-arrival guarantee.",
			},
			{
				question: "What if my order arrives damaged or dead?",
				answer:
					"Contact us within 24 hours of delivery with photos of the packaging and animals. We will arrange a replacement or refund under our live-arrival policy.",
			},
			{
				question: "Can I track my order?",
				answer:
					"Once your order ships, we email a tracking link. You can also sign in and open your account to view the latest order status.",
			},
		],
	},
	{
		title: "Livestock & products",
		items: [
			{
				question: "Are your livestock quarantined?",
				answer:
					"Every fish, shrimp, and plant completes a 14-day quarantine and health check before it is listed for sale.",
			},
			{
				question: "How are livestock packed for shipping?",
				answer:
					"Each animal is bagged with oxygen, cushioned, and packed in an insulated box. We schedule shipments to avoid weekend delays.",
			},
			{
				question: "Can I return dry goods?",
				answer:
					"Unopened dry goods can be returned within 30 days of delivery. Livestock, opened food, and medications cannot be returned for health reasons.",
			},
		],
	},
	{
		title: "Account",
		items: [
			{
				question: "Do I need an account to place an order?",
				answer:
					"You can browse the store without an account. Sign in to save your details, track orders, and manage live-arrival claims.",
			},
			{
				question: "How do I reset my password?",
				answer:
					"Open the sign-in page and use the password reset option. If you do not receive an email, check your spam folder or contact support.",
			},
		],
	},
];

export default function FaqPage() {
	return (
		<div className={styles.page}>
			<section className={`${styles.hero} page-container`}>
				<SectionHeading
					id="faq-title"
					level={1}
					align="center"
					eyebrow="Support"
					title="Frequently asked questions"
					description="Everything you need to know about ordering, shipping, livestock care, and your account."
				/>
			</section>

			<section className={`${styles.section} page-container`} aria-labelledby="faq-title">
				<div className={styles.sectionNarrow}>
					{faqGroups.map((group) => (
						<div className={styles.group} key={group.title}>
							<h2 className={styles.groupTitle}>{group.title}</h2>

							<div className={styles.faqList}>
								{group.items.map((item) => (
									<details className={styles.faqItem} key={item.question}>
										<summary className={styles.faqQuestion}>
											{item.question}
											<span className={styles.faqToggle} aria-hidden="true">
												+
											</span>
										</summary>
										<p className={styles.faqAnswer}>{item.answer}</p>
									</details>
								))}
							</div>
						</div>
					))}

					<div className={styles.cta}>
						<h2>Still have questions?</h2>
						<p>
							Our team answers within 24 hours, even on weekends. Send us your
							tank details and we will point you in the right direction.
						</p>
						<Link href="/contact" className={styles.ctaButton}>
							Contact us
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
