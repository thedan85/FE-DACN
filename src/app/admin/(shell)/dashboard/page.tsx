import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
	title: "Dashboard",
};

export default function AdminDashboardPage() {
	return (
		<section className={styles.placeholder}>
			<h1 className={styles.heading}>Dashboard</h1>
			<p className={styles.description}>
				Store metrics, recent orders, and inventory alerts will appear here once
				real admin data is wired up.
			</p>
		</section>
	);
}
