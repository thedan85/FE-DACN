"use client";

import Link from "next/link";
import {
	CustomerServiceOutlined,
	DropboxOutlined,
	LockOutlined,
	MessageOutlined,
	RocketOutlined,
	SafetyCertificateOutlined,
	TeamOutlined,
} from "@ant-design/icons";
import styles from "./page.module.css";

export default function Page() {
	return (
		<div className={styles.home}>
			<section className={styles.hero} aria-labelledby="hero-title">
				<div className={`${styles.heroInner} page-container`}>
					<div className={styles.heroCopy}>
						<p className={styles.heroEyebrow}>
							<span aria-hidden="true">◉</span> Premium aquarium supplies
						</p>
						<h1 id="hero-title">
							Everything your
							<br />
							<span>underwater world needs.</span>
						</h1>
						<p className={styles.heroDescription}>
							Everything you need to build, care for, and improve your aquarium.
						</p>
						<Link className={styles.primaryButton} href="/products">
							Shop Now
						</Link>
					</div>

					<div className={styles.heroBenefits}>
						<div>
							<RocketOutlined />
							<strong>Fast Delivery</strong>
							<span>Carefully packed and shipped</span>
						</div>
						<div>
							<LockOutlined />
							<strong>Secure Payment</strong>
							<span>Safe and reliable checkout</span>
						</div>
						<div>
							<CustomerServiceOutlined />
							<strong>Expert Support</strong>
							<span>Help for aquarium enthusiasts</span>
						</div>
					</div>
				</div>
			</section>

			<section className={`${styles.categories}`} aria-labelledby="categories-title">
				<div className="page-container">
					<div className={styles.sectionIntro}>
						<h2 id="categories-title">Shop by category</h2>
						<Link href="/products" className={styles.sectionLink}>Shop Now <span aria-hidden="true">→</span></Link>
					</div>

					<div className={styles.categoryGrid}>
						<article className={`${styles.categoryCard} ${styles.livestock}`}>
							<div>
								<h3>Livestock</h3>
								<p>Fish, shrimp, snails &amp; plants</p>
							</div>
						</article>
						<article className={`${styles.categoryCard} ${styles.consumables}`}>
							<div>
							<h3>Consumables</h3>
							<p>Food, fertilizers &amp; medications for daily care</p>
							</div>
						</article>
						<article className={`${styles.categoryCard} ${styles.equipment}`}>
							<div>
							<h3>Equipment</h3>
							<p>Filters, lights, tanks &amp; tools for every setup</p>
							</div>
						</article>
					</div>
				</div>
			</section>

			<section className={styles.features} aria-labelledby="features-title">
				<div className="page-container">
					<div className={styles.featureIntro}>
						<p className={`eyebrow ${styles.featureEyebrow}`}>Why choose us</p>
						<h2 id="features-title">Built for hobbyists, by hobbyists</h2>
					</div>
					<div className={styles.featureGrid}>
							<div className={styles.featureCard}>
								<span className={styles.featureIcon}><SafetyCertificateOutlined /></span>
								<h3>Quarantined Livestock</h3>
								<p>Every fish, shrimp, and plant goes through a 14-day quarantine before being listed.</p>
							</div>
							<div className={styles.featureCard}>
								<span className={styles.featureIcon}><DropboxOutlined /></span>
								<h3>Safe Delivery Guarantee</h3>
								<p>Climate-controlled packaging with a live-arrival guarantee on all livestock orders.</p>
							</div>
							<div className={styles.featureCard}>
								<span className={styles.featureIcon}><MessageOutlined /></span>
								<h3>Expert Support</h3>
								<p>Our aquascaping team answers questions within 24 hours — even on weekends.</p>
							</div>
							<div className={styles.featureCard}>
								<span className={styles.featureIcon}><TeamOutlined /></span>
								<h3>Active Community</h3>
								<p>Join 12,000+ hobbyists sharing tips, tank journals, and aquascaping inspiration.</p>
							</div>
					</div>
				</div>
			</section>

		</div>
	);
}
