import type { Metadata } from "next";
import Link from "next/link";
import { RevealGroup } from "@/components/ui/reveal";
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
		<RevealGroup className={styles.page} revealedClassName={styles.revealed}>
			<section className={`${styles.faqHero} page-container`} aria-labelledby="faq-title">
				<div className={styles.faqLayout}>
					<aside className={styles.faqAside}>
						<div className={`${styles.asideIntro} ${styles.reveal}`} data-reveal>
							<p className="eyebrow">Support</p>
							<h1 id="faq-title">Frequently asked questions</h1>
							<p className={styles.lede}>
								Everything you need to know about ordering, shipping, livestock
								care, and your account.
							</p>
							<dl className={styles.asideMeta}>
								<div>
									<dt>Reply time</dt>
									<dd>Under 24 hours</dd>
								</div>
								<div>
									<dt>Support days</dt>
									<dd>7 days a week</dd>
								</div>
							</dl>
						</div>

						<div className={`${styles.supportCard} ${styles.reveal}`} data-reveal>
							<span className={styles.supportIcon} aria-hidden="true">
								?
							</span>
							<h2>Still have questions?</h2>
							<p>
								Send us your tank details and we will point you in the right
								direction.
							</p>
							<Link href="/contact" className={styles.supportButton}>
								Contact us <span aria-hidden="true">→</span>
							</Link>
						</div>
					</aside>

					<div className={styles.faqMain}>
						{faqGroups.map((group, groupIndex) => (
							<section
								key={group.title}
								aria-labelledby={`faq-group-${groupIndex}`}
							>
								<div className={`${styles.groupHeader} ${styles.reveal}`} data-reveal>
									<h2 id={`faq-group-${groupIndex}`}>{group.title}</h2>
									<span>{group.items.length} questions</span>
								</div>

								<div className={styles.faqList}>
									{group.items.map((item) => (
										<details
											className={`${styles.faqItem} ${styles.reveal}`}
											key={item.question}
											data-reveal
										>
											<summary className={styles.faqQuestion}>
												<span>{item.question}</span>
												<span className={styles.faqToggle} aria-hidden="true">
													+
												</span>
											</summary>
											<p className={styles.faqAnswer}>{item.answer}</p>
										</details>
									))}
								</div>
							</section>
						))}
					</div>
				</div>
			</section>
		</RevealGroup>
	);
}
