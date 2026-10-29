import type { ButtonHTMLAttributes } from "react";
import styles from "./auth-controls.module.css";

export function PrimaryButton({
	children,
	...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button type="submit" className={styles.primary} {...buttonProps}>
			{children}
		</button>
	);
}

export function Divider() {
	return (
		<div className={styles.divider} role="separator" aria-label="Or">
			<span>Or</span>
		</div>
	);
}
