import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
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
		<div className={styles.page}>
			<section className={`${styles.hero} page-container`}>
				<SectionHeading
					id="about-title"
					level={1}
					align="center"
					eyebrow="Our story"
					title="Built by hobbyists, for living water"
					description="AquariumStore exists to make healthy livestock and dependable equipment easier to find, ship, and keep alive."
				/>
			</section>

			<section className={`${styles.section} page-container`} aria-labelledby="about-title">
				<div className={styles.story}>
					<div className={styles.storyCopy}>
						<p>
							We started in a garage with a rack of quarantine tanks and a
							simple frustration: too many fish arrive stressed, sick, or
							misidentified. So we built the store we wanted to buy from.
						</p>
						<p>
							Today we work with local breeders and importers who share our
							standards. Every animal is observed, fed, and checked before it
							reaches a listing. Dry goods are chosen for reliability, not
							margin.
						</p>
						<p>
							Whether you are planting your first nano tank or maintaining a
							rack of breeding pairs, our team is here to help you keep the
							water right.
						</p>
					</div>

					<Image
						src="/images/hero_background.jpg"
						alt="Planted aquarium with healthy livestock"
						width={900}
						height={640}
						className={styles.storyImage}
					/>
				</div>
			</section>

			<section className={`${styles.section} page-container`}>
				<SectionHeading
					level={2}
					align="center"
					eyebrow="What we stand for"
					title="A better way to keep fish"
				/>

				<div className={styles.valueGrid}>
					{values.map((value) => (
						<article className={styles.valueCard} key={value.title}>
							<h3>{value.title}</h3>
							<p>{value.body}</p>
						</article>
					))}
				</div>

				<div className={styles.stats}>
					{stats.map((stat) => (
						<div className={styles.stat} key={stat.label}>
							<strong>{stat.value}</strong>
							<span>{stat.label}</span>
						</div>
					))}
				</div>

				<div className={styles.cta}>
					<h2>Ready to build your underwater world?</h2>
					<p>
						Browse quarantined livestock, plants, and equipment picked for
						everyday aquarium care.
					</p>
					<Link href="/products" className={styles.ctaButton}>
						Shop Now
					</Link>
				</div>
			</section>
		</div>
	);
}
