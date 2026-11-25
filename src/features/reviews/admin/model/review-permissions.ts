export const REVIEW_PERMISSIONS = {
	read: "review:read",
	delete: "review:delete",
} as const;

export type ReviewPermission =
	(typeof REVIEW_PERMISSIONS)[keyof typeof REVIEW_PERMISSIONS];
