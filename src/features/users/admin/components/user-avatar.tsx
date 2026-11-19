"use client";

import { userInitials } from "../model/user-format";
import styles from "./user-avatar.module.css";

type UserAvatarProps = {
	name: string | null;
	email: string;
	/** `sm` is the table row (34px); `lg` is a detail header (64px). */
	size?: "sm" | "lg";
};

/**
 * Initials avatar. Not an image: the user API returns no avatar URL, and
 * inventing one would show a stranger's face or a broken tile. The initials
 * fall back to the email's first character, then to `?`.
 */
export function UserAvatar({ name, email, size = "sm" }: UserAvatarProps) {
	return (
		<span
			className={`${styles.avatar} ${styles[size]}`}
			aria-hidden="true"
			data-size={size}
		>
			{userInitials(name, email)}
		</span>
	);
}
