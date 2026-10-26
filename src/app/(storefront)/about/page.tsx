import type { Metadata } from "next";
import Link from "next/link";
import { RevealGroup } from "@/components/ui/reveal";
import styles from "../info-page.module.css";

export const metadata: Metadata = {
	title: "About Us",
	description:
		"Learn how AquariumStore sources, quarantines, and ships livestock for aquascapers.",
};

const values = [
	{
		title: "Quarantined livestock",
		body: "Every fish, shrimp, and plant spends 14 days in observation before it is listed, so you bring home healthy animals.",
	},
	{
		title: "Safe delivery",
		body: "Climate-controlled packaging, oxygenated bags, and live-arrival coverage on every livestock order.",
	},
	{
		title: "Expert support",
		body: "Our aquascaping team answers questions within 24 hours — even on weekends.",
	},
];

const stats = [
	{ value: "14 days", label: "Quarantine before sale" },
	{ value: "12,000+", label: "Hobbyists in our community" },
	{ value: "24 hours", label: "Average support reply" },
];

export default function AboutPage() {
	return (
		<RevealGroup className={styles.page} revealedClassName={styles.revealed}>
			<section className={`${styles.aboutHero} page-container`} aria-labelledby="about-title">
				<div className={`${styles.aboutHeroCopy} ${styles.reveal}`} data-reveal>
					<p className="eyebrow">Our story</p>
					<h1 id="about-title">Built by hobbyists, for living water</h1>
					<p className={styles.lede}>
						AquariumStore exists to make healthy livestock and dependable
						equipment easier to find, ship, and keep alive.
					</p>
					<div className={styles.heroActions}>
						<Link href="/products" className={styles.ctaButton}>
							Shop Now <span aria-hidden="true">→</span>
						</Link>
						<Link href="/faq" className={styles.textLink}>
							Read the FAQ <span aria-hidden="true">→</span>
						</Link>
					</div>
				</div>
			</section>

			<section className={`${styles.section} page-container`}>
				<div className={`${styles.storyCopy} ${styles.reveal}`} data-reveal>
					<p className="eyebrow">How we got here</p>
					<h2>A garage rack and a simple frustration</h2>
					<p>
						We started in a garage with a rack of quarantine tanks and a simple
						frustration: too many fish arrive stressed, sick, or misidentified.
						So we built the store we wanted to buy from.
					</p>
					<p>
						Today we work with local breeders and importers who share our
						standards. Every animal is observed, fed, and checked before it
						reaches a listing. Dry goods are chosen for reliability, not margin.
					</p>
					<p>
						Whether you are planting your first nano tank or maintaining a rack
						of breeding pairs, our team is here to help you keep the water right.
					</p>
				</div>
			</section>

			<section className={`${styles.section} page-container`}>
				<div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
					<p className="eyebrow">What we stand for</p>
					<h2>A better way to keep fish</h2>
				</div>

				<div className={styles.valueGrid}>
					{values.map((value, index) => (
						<article
							className={`${styles.valueCard} ${styles.reveal}`}
							key={value.title}
							data-reveal
						>
							<span className={styles.valueNumber} aria-hidden="true">
								{String(index + 1).padStart(2, "0")}
							</span>
							<h3>{value.title}</h3>
							<p>{value.body}</p>
						</article>
					))}
				</div>

				<div className={`${styles.stats} ${styles.reveal}`} data-reveal>
					{stats.map((stat) => (
						<div className={styles.stat} key={stat.label}>
							<strong>{stat.value}</strong>
							<span>{stat.label}</span>
						</div>
					))}
				</div>
			</section>

			<section className={`${styles.ctaSection} page-container`}>
				<div className={`${styles.ctaPanel} ${styles.reveal}`} data-reveal>
					<p className="eyebrow">Start your tank</p>
					<h2>Ready to build your underwater world?</h2>
					<p>
						Browse quarantined livestock, plants, and equipment picked for
						everyday aquarium care.
					</p>
					<Link href="/products" className={styles.ctaButton}>
						Shop Now <span aria-hidden="true">→</span>
					</Link>
				</div>
			</section>
		</RevealGroup>
	);
}
