import { ExperimentOutlined } from "@ant-design/icons";
import { Tag } from "antd";

import type { CartCompatibility } from "../../types";
import styles from "./compatibility-card.module.css";

const TAG = {
	SAFE: { color: "green", label: "Compatible" },
	CAUTION: { color: "gold", label: "Caution" },
	NOT_RECOMMENDED: { color: "red", label: "Not Recommended" },
	UNKNOWN: { color: "default", label: "Not Enough Data" },
	INFO: { color: "blue", label: "Add Another Species" },
} as const;

const CHECK_CLASS = {
	PASS: styles.pass,
	WARN: styles.warn,
	FAIL: styles.fail,
	UNKNOWN: styles.unknown,
} as const;

export function CompatibilityCard({
	compatibility,
}: {
	compatibility: CartCompatibility;
}) {
	const tag = TAG[compatibility.verdict];

	return (
		<div className={styles.card}>
			<ExperimentOutlined className={styles.icon} />
			<div className={styles.body}>
				<div className={styles.heading}>
					<h2>Biotope Compatibility Check</h2>
					<Tag color={tag.color}>{tag.label}</Tag>
				</div>
				<p>{compatibility.summary}</p>
				{compatibility.checks.length > 0 && (
					<ul className={styles.checks}>
						{compatibility.checks.map((check, index) => (
							<li
								key={`${check.code}-${index}`}
								className={CHECK_CLASS[check.status]}
							>
								{check.message}
							</li>
						))}
					</ul>
				)}
				{compatibility.recommendedTankLitres != null && (
					<p className={styles.tank}>
						Recommended tank: {compatibility.recommendedTankLitres} L or larger.
					</p>
				)}
			</div>
		</div>
	);
}
