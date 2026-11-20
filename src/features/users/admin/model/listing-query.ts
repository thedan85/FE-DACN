import { toApiPage } from "@/lib/api/pagination";

import {
	ADMIN_USER_SORT_FIELDS,
	type AdminUserSort,
	type AdminUserSortField,
	type ListAdminUsersParams,
} from "../api/users.api";
import type { UserAccountStatus } from "../schema/user.schema";

import { CUSTOMER_ROLE_CODE } from "./roles";

/**
 * The user listing's URL state: the single place filter values become safe to
 * send.
 *
 * Everything the user can put in the URL is untrusted. The backend answers 400
 * for an unknown `status` or an unsupported `sort` field, and it silently
 * ignores a parameter it does not recognise — so a typo or an edited URL would
 * either break the page or return an unfiltered page that looks filtered. Every
 * field is therefore validated here and degrades to its default.
 */

/** Page size the listing requests; also the value the footer counts by. */
export const USERS_PAGE_SIZE = 20;

/** Max characters accepted for the keyword or role code before it is discarded. */
const MAX_TEXT_LENGTH = 100;

/** Upper clamp on the page index, to keep absurd URLs out of API calls. */
const MAX_PAGE = 10_000;

export interface UsersListingQuery {
	/** Case-insensitive match on email or the current-role profile name. */
	keyword: string | undefined;
	/** Lowercase role code; `undefined` means every role. */
	roleCode: string | undefined;
	/** `undefined` is the "All" tab; the API has no "all statuses" value. */
	status: UserAccountStatus | undefined;
	sort: AdminUserSort;
	/** 1-based, because the URL is what a user reads. Converted on send. */
	page: number;
}

/** The staff compat route's address. */
export const STAFF_PATH = "/admin/staff";

/** The staff screen's default role, matching the retired staff directory. */
export const DEFAULT_STAFF_ROLE_CODE = "employee";

export const DEFAULT_USERS_LISTING_QUERY: UsersListingQuery = {
	keyword: undefined,
	roleCode: undefined,
	status: undefined,
	sort: "createdAt,desc",
	page: 1,
};

export const STAFF_DEFAULT_USERS_LISTING_QUERY: UsersListingQuery = {
	...DEFAULT_USERS_LISTING_QUERY,
	roleCode: DEFAULT_STAFF_ROLE_CODE,
};

/**
 * The sort choices the listing offers, in menu order. `value` is exactly what
 * the API's Spring-style converter accepts, so a chosen option can never be an
 * unsupported field.
 */
export const USER_SORT_OPTIONS = [
	{ value: "createdAt,desc", label: "Newest first" },
	{ value: "createdAt,asc", label: "Oldest first" },
	{ value: "name,asc", label: "Name A–Z" },
	{ value: "name,desc", label: "Name Z–A" },
	{ value: "email,asc", label: "Email A–Z" },
	{ value: "lastLogin,desc", label: "Last sign-in" },
] as const satisfies readonly { value: AdminUserSort; label: string }[];

export type UserStatusTab = {
	value: UserAccountStatus | undefined;
	label: string;
};

/** The three tabs above the table. */
export const USER_STATUS_TABS: readonly UserStatusTab[] = [
	{ value: undefined, label: "All" },
	{ value: "ACTIVE", label: "Active" },
	{ value: "LOCKED", label: "Locked" },
];

/** Next gives a repeated query param as an array; take the first value. */
function firstValue(value: unknown): string {
	if (Array.isArray(value)) {
		return String(value[0] ?? "");
	}

	return value == null ? "" : String(value);
}

function parseStatus(value: unknown): UserAccountStatus | undefined {
	const candidate = firstValue(value).toUpperCase();

	return candidate === "ACTIVE" || candidate === "LOCKED"
		? candidate
		: undefined;
}

function parseText(value: unknown): string | undefined {
	const candidate = firstValue(value).trim();

	return candidate === "" || candidate.length > MAX_TEXT_LENGTH
		? undefined
		: candidate;
}

const CANONICAL_SORT_FIELDS: readonly AdminUserSortField[] =
	ADMIN_USER_SORT_FIELDS;

/**
 * Rebuilds a canonical `field,asc|desc` from untrusted input.
 *
 * The field is matched case-insensitively (so `createdat,desc` from a
 * hand-edited URL still works), then written back in the whitelist's own
 * spelling, because `createdAt` is the form the API accepts. A field outside
 * the whitelist, or a direction that is neither `asc` nor `desc`, is a default
 * sort rather than a 400.
 */
function parseSort(value: unknown): AdminUserSort {
	const [rawField = "", rawDirection = ""] = firstValue(value).split(",");
	const field = CANONICAL_SORT_FIELDS.find(
		(candidate) =>
			candidate.toLowerCase() === rawField.trim().toLowerCase(),
	);
	const direction = rawDirection.trim().toLowerCase();

	if (!field || (direction !== "asc" && direction !== "desc")) {
		return DEFAULT_USERS_LISTING_QUERY.sort;
	}

	return `${field},${direction}`;
}

function parsePage(value: unknown): number {
	const parsed = Number(firstValue(value));

	if (!Number.isInteger(parsed)) {
		return 1;
	}

	return Math.min(Math.max(parsed, 1), MAX_PAGE);
}

/**
 * Parses untrusted search params into a listing query. Cannot fail: every field
 * falls back to its default, so a hand-edited URL renders the default page
 * rather than an error.
 */
export function parseUsersListingQuery(
	params: Record<string, unknown>,
): UsersListingQuery {
	return {
		keyword: parseText(params.keyword),
		// The API compares role codes case-insensitively but returns them
		// lowercase, so normalising here keeps the URL and the selected option
		// in the same spelling.
		roleCode: parseText(params.roleCode)?.toLowerCase(),
		status: parseStatus(params.status),
		sort: parseSort(params.sort),
		page: parsePage(params.page),
	};
}

/**
 * The staff compat screen's parse rule. It inherits the general parser's
 * validation, then refuses the customer role in any spelling: the staff
 * screen can never filter or display its way into the customer directory.
 * Rejection falls back to the staff default rather than erroring, matching
 * the parser's no-throw contract. A keyword is dropped: it can carry PII, so
 * staff mode keeps it in component state and never reads it from a URL.
 */
export function parseStaffUsersListingQuery(
	params: Record<string, unknown>,
): UsersListingQuery {
	const query = parseUsersListingQuery(params);
	const staffQuery: UsersListingQuery = { ...query, keyword: undefined };

	if (
		staffQuery.roleCode === undefined ||
		staffQuery.roleCode.toLowerCase() === CUSTOMER_ROLE_CODE
	) {
		return { ...staffQuery, roleCode: DEFAULT_STAFF_ROLE_CODE };
	}

	return staffQuery;
}

/**
 * The redirect for the retired `tab=roles` staff URL: the roles experience
 * lives at `/admin/roles` now. Anything else stays on the staff view, so
 * stale links degrade to the nearest useful page instead of an error.
 *
 * Case- and whitespace-insensitive because the URL is hand-editable input;
 * the first value wins for a repeated parameter, like the rest of the parser.
 */
export function rolesTabRedirect(
	tab: string | string[] | undefined,
): "/admin/roles" | null {
	const first = firstValue(tab).trim().toLowerCase();

	return first === "roles" ? "/admin/roles" : null;
}

/**
 * Builds the router query from a listing query, omitting defaults so the
 * unfiltered view keeps the bare listing URL. The `defaults` argument is what
 * the caller treats as "no filter"; the staff screen passes its employee
 * default so a bare `/admin/staff` URL means the same thing the user sees.
 */
export function toUsersSearchParams(
	query: UsersListingQuery,
	defaults: UsersListingQuery = DEFAULT_USERS_LISTING_QUERY,
): Record<string, string> {
	const params: Record<string, string> = {};

	if (query.keyword) {
		params.keyword = query.keyword;
	}

	if (query.roleCode && query.roleCode !== defaults.roleCode) {
		params.roleCode = query.roleCode;
	}

	if (query.status) {
		params.status = query.status;
	}

	if (query.sort !== defaults.sort) {
		params.sort = query.sort;
	}

	if (query.page > 1) {
		params.page = String(query.page);
	}

	return params;
}

/** The listing href, for links and `router.push`. */
export function toUsersListingHref(
	query: UsersListingQuery,
	base: string = "/admin/users",
	defaults: UsersListingQuery = DEFAULT_USERS_LISTING_QUERY,
): string {
	const search = new URLSearchParams(toUsersSearchParams(query, defaults)).toString();

	return search ? `${base}?${search}` : base;
}

/**
 * Converts the URL query into the API's parameters, doing the one 1-based to
 * 0-based page conversion and fixing the page size.
 */
export function toUsersApiParams(
	query: UsersListingQuery,
): ListAdminUsersParams {
	return {
		keyword: query.keyword,
		roleCode: query.roleCode,
		status: query.status,
		sort: query.sort,
		page: toApiPage(query.page),
		size: USERS_PAGE_SIZE,
	};
}
