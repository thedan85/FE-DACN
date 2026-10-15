"use client";

import Link from "next/link";
import styles from "./site-footer.module.css";
import { FacebookFilled, InstagramFilled, TwitterOutlined, YoutubeFilled, ThreadsFilled } from "@ant-design/icons";

const footerColumns = [
	{
		title: "Shop",
		links: [
			{ label: "All Products", href: "/products" },
			{ label: "Fish", href: "/products?category=fish" },
			{ label: "Plants", href: "/products?category=plants" },
			{ label: "Equipment", href: "/products?category=equipment" },
		],
	},
	{
		title: "Company",
		links: [
			{ label: "About Us", href: "/about" },
			{ label: "Careers", href: "/careers" },
			{ label: "Contact", href: "/contact" },
			{ label: "Blog", href: "/blog" },
		],
	},
	{
		title: "Community",
		links: [
			{ label: "Forum", href: "/community/forum" },
			{ label: "Gallery", href: "/community/gallery" },
			{ label: "Events", href: "/community/events" },
			{ label: "Support", href: "/support" },
		],
	},
	{
		title: "Legal",
		links: [
			{ label: "Privacy Policy", href: "/privacy" },
			{ label: "Terms of Service", href: "/terms" },
			{ label: "Returns", href: "/returns" },
		],
	},
];

export function SiteFooter() {
	const currentYear = new Date().getFullYear();

	return (
		<footer className={styles.footer}>
			<div className={`${styles.container} page-container`}>
				<nav className={styles.columns} aria-label="Footer navigation">
					{footerColumns.map((column) => (
						<div className={styles.column} key={column.title}>
							<h2 className={styles.columnHeading}>{column.title}</h2>

							<ul className={styles.linkList}>
								{column.links.map((link) => (
									<li key={link.label}>
										<Link className={styles.footerLink} href={link.href}>
											{link.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>

				<div className={styles.bottomBar}>
					<div className={styles.copyright}>
						{/* <span className={styles.brandBadge} aria-hidden="true">
							N
						</span> */}

						<p className={styles.copyrightText}>
							© {currentYear} Aquarium Store. All rights reserved.
						</p>
					</div>
					<div className={styles.socialLinks}>
						<Link
							href="https://www.facebook.com"
							aria-label="Facebook"
						>
							<FacebookFilled />
						</Link>
						<Link
							href="https://www.instagram.com"
							aria-label="Instagram"
						>
							<InstagramFilled />
						</Link>
						<Link
							href="https://www.twitter.com"
							aria-label="Twitter"
						>
							<TwitterOutlined />
						</Link>
						<Link
							href="https://www.youtube.com"
							aria-label="YouTube"
						>
							<YoutubeFilled />
						</Link>
						<Link
							href="https://www.threads.com"
							aria-label="Threads"
						>
							<ThreadsFilled />
						</Link>
					</div>
				</div>
			</div>
		</footer>
	);
}
