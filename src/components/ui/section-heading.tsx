
import type { ReactNode } from "react";
import styles from "./section-heading.module.css";

type SectionHeadingProps = {
	title: ReactNode;
	eyebrow?: ReactNode;
	description?: ReactNode;
	level?: 1 | 2 | 3;
	align?: "left" | "center";
	className?: string;
	id?: string;
};

export function SectionHeading({
	title,
	eyebrow,
	description,
	level = 2,
	align = "left",
	className,
	id,
}: SectionHeadingProps) {
	const HeadingTag =
		level === 1 ? "h1" : level === 2 ? "h2" : "h3";

	const classes = [
		styles.root,
		align === "center" ? styles.center : styles.left,
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<header className={classes} id={id}>
			{eyebrow != null && (
				<p className={`eyebrow ${styles.eyebrow}`}>
					{eyebrow}
				</p>
			)}

			<HeadingTag className={styles.title}>
				{title}
			</HeadingTag>

			{description != null && (
				<p className={styles.description}>
					{description}
				</p>
			)}
		</header>
	);
}
