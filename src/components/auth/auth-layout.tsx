import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./auth-layout.module.css";

type AuthLayoutProps = {
	children: ReactNode;
	eyebrow: string;
	headline: string;
	description: string;
};

export function AuthLayout({
	children,
	eyebrow,
	headline,
	description,
}: AuthLayoutProps) {
	return (
		<div className={styles.root}>
			<main className={styles.formPanel}>
				<div className={styles.formContent}>{children}</div>
			</main>

			<aside className={styles.imagePanel}>
				<Image
					src="/images/login_register_img.webp"
					alt="Killifish swimming in a planted aquarium"
					fill
					priority
					sizes="(max-width: 1024px) 100vw, 57vw"
					className={styles.image}
				/>
				<div className={styles.overlay} aria-hidden="true" />

				<div className={styles.imageContent}>
					<p className={styles.eyebrow}>{eyebrow}</p>
					<h2 className={styles.headline}>{headline}</h2>
					<p className={styles.description}>{description}</p>
				</div>
			</aside>
		</div>
	);
}
