import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
		<div className={styles.aboutPage}>
			<section className={`${styles.aboutHero} page-container`} aria-labelledby="about-title">
				<div className={styles.aboutHeroCopy}>
					<p className="eyebrow">About Aquarium Store</p>
					<h1 id="about-title">Built by hobbyists. <span>For living water.</span></h1>
					<p className={styles.lede}>
						Aquarium Store makes it easier to find healthy livestock and dependable
						equipment for the tanks you love to keep.
					</p>
					<div className={styles.heroActions}>
						<Link href="/products" className={styles.ctaButton}>
							Shop Now <span aria-hidden="true">→</span>
						</Link>
					</div>
				</div>
				<figure className={styles.aboutFigure}>
					<div className={styles.aboutPhoto}>
						<Image
							src="/images/hero_background.jpg"
							alt="A planted aquarium with branching driftwood and bright green aquatic plants"
							fill
							sizes="(max-width: 820px) calc(100vw - 48px), (max-width: 1328px) 48vw, 640px"
							loading="eager"
						/>
					</div>
					<figcaption>Freshwater aquascaping</figcaption>
				</figure>
			</section>

			<div className="page-container">
				<dl className={styles.stats}>
					{stats.map((stat) => (
						<div className={styles.stat} key={stat.label}>
							<dt>{stat.label}</dt>
							<dd>{stat.value}</dd>
						</div>
					))}
				</dl>
			</div>

			<section className={`${styles.aboutStory} page-container`} aria-labelledby="about-story">
				<div className={styles.aboutSectionHead}>
					<p className="eyebrow">How we got here</p>
					<h2 id="about-story">A garage rack and a simple frustration</h2>
				</div>
				<div className={styles.storyCopy}>
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

			<section className={`${styles.aboutPromises} page-container`} aria-labelledby="about-promises">
				<div className={styles.aboutSectionHead}>
					<p className="eyebrow">What we stand for</p>
					<h2 id="about-promises">A better way to keep fish</h2>
				</div>

				<ol className={styles.valueList} role="list">
					{values.map((value, index) => (
						<li className={styles.valueItem} key={value.title}>
							<span className={styles.valueNumber} aria-hidden="true">
								{String(index + 1).padStart(2, "0")}
							</span>
							<div>
								<h3>{value.title}</h3>
								<p>{value.body}</p>
							</div>
						</li>
					))}
				</ol>
			</section>

			<section className={`${styles.ctaPanel} page-container`} aria-labelledby="about-next">
				<div className={styles.aboutSectionHead}>
					<p className="eyebrow">Start your tank</p>
					<h2 id="about-next">Ready to build your underwater world?</h2>
					<p>
						Browse quarantined livestock, plants, and equipment picked for
						everyday aquarium care.
					</p>
				</div>
				<div className={styles.heroActions}>
					<Link href="/products" className={styles.ctaButton}>
						Shop Now <span aria-hidden="true">→</span>
					</Link>
					<Link href="/faq" className={styles.textLink}>
						Read the FAQ <span aria-hidden="true">→</span>
					</Link>
				</div>
			</section>
		</div>
	);
}
