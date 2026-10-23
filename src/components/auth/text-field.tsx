import type { InputHTMLAttributes } from "react";
import styles from "./text-field.module.css";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
	id: string;
	label: string;
	error?: string;
};

export function TextField({
	id,
	label,
	className,
	error,
	...inputProps
}: TextFieldProps) {
	const errorId = error ? `${id}-error` : undefined;

	return (
		<div className={styles.field}>
			<label htmlFor={id} className={styles.label}>
				{label}
			</label>
			<input
				{...inputProps}
				id={id}
				className={[styles.input, error && styles.inputError, className]
					.filter(Boolean)
					.join(" ")}
				aria-invalid={error ? true : undefined}
				aria-describedby={errorId}
			/>
			{error && (
				<p id={errorId} className={styles.errorText} role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
