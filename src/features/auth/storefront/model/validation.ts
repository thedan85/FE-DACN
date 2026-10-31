const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
	const email = value.trim();

	if (!email) {
		return "Email is required.";
	}

	if (!EMAIL_PATTERN.test(email)) {
		return "Enter a valid email address, e.g. name@example.com.";
	}

	return null;
}

export function validateRequired(value: string, label: string): string | null {
	return value.trim() ? null : `${label} is required.`;
}
