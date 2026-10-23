"use client";

import { useState } from "react";
import { EyeInvisibleOutlined, EyeOutlined } from "@ant-design/icons";
import styles from "./text-field.module.css";

type PasswordFieldProps = {
	id: string;
	label: string;
	name: string;
	placeholder?: string;
	autoComplete: string;
	required?: boolean;
	minLength?: number;
	error?: string;
};

export function PasswordField({
	id,
	label,
	name,
	placeholder,
	autoComplete,
	required,
	minLength,
	error,
}: PasswordFieldProps) {
	const [visible, setVisible] = useState(false);
	const errorId = error ? `${id}-error` : undefined;

	return (
		<div className={styles.field}>
			<label htmlFor={id} className={styles.label}>
				{label}
			</label>
			<div className={styles.passwordWrap}>
				<input
					id={id}
					name={name}
					type={visible ? "text" : "password"}
					placeholder={placeholder}
					autoComplete={autoComplete}
					required={required}
					minLength={minLength}
					aria-invalid={error ? true : undefined}
					aria-describedby={errorId}
					className={[
						styles.input,
						styles.passwordInput,
						error && styles.inputError,
					]
						.filter(Boolean)
						.join(" ")}
				/>
				<button
					type="button"
					className={styles.toggle}
					onClick={() => setVisible((current) => !current)}
					aria-label={visible ? "Hide password" : "Show password"}
					aria-pressed={visible}
				>
					{visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
				</button>
			</div>
			{error && (
				<p id={errorId} className={styles.errorText} role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
