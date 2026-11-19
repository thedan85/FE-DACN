import { expect, it } from "vitest";

import {
	DEFAULT_STAFF_ROLE_CODE,
	DEFAULT_USERS_LISTING_QUERY,
	STAFF_DEFAULT_USERS_LISTING_QUERY,
	STAFF_PATH,
	USER_SORT_OPTIONS,
	USERS_PAGE_SIZE,
	parseStaffUsersListingQuery,
	parseUsersListingQuery,
	rolesTabRedirect,
	toUsersApiParams,
	toUsersListingHref,
	toUsersSearchParams,
} from "./listing-query";

/**
 * The user listing's URL state. The backend answers 400 for an unknown status
 * or sort field and silently ignores a misspelled parameter, so raw URL input
 * must never reach it.
 */

it("defaults to the first page of every status, newest first", () => {
	expect(parseUsersListingQuery({})).toEqual(DEFAULT_USERS_LISTING_QUERY);
	expect(DEFAULT_USERS_LISTING_QUERY).toMatchObject({
		status: undefined,
		sort: "createdAt,desc",
		page: 1,
	});
});

it("accepts only the two statuses the user endpoints return", () => {
	expect(parseUsersListingQuery({ status: "ACTIVE" }).status).toBe("ACTIVE");
	expect(parseUsersListingQuery({ status: "LOCKED" }).status).toBe("LOCKED");
	expect(parseUsersListingQuery({ status: "locked" }).status).toBe("LOCKED");
	// DELETED is a 400 from the API and is never reachable from these screens.
	expect(parseUsersListingQuery({ status: "DELETED" }).status).toBeUndefined();
	expect(parseUsersListingQuery({ status: "nonsense" }).status).toBeUndefined();
	expect(parseUsersListingQuery({ status: "" }).status).toBeUndefined();
});

it("keeps a trimmed keyword and drops a blank or oversized one", () => {
	expect(parseUsersListingQuery({ keyword: "  alice  " }).keyword).toBe("alice");
	expect(parseUsersListingQuery({ keyword: "   " }).keyword).toBeUndefined();
	expect(
		parseUsersListingQuery({ keyword: "a".repeat(200) }).keyword,
	).toBeUndefined();
});

it("lowercases the role code so it matches the API's own spelling", () => {
	expect(parseUsersListingQuery({ roleCode: " Admin " }).roleCode).toBe("admin");
	expect(parseUsersListingQuery({ roleCode: "" }).roleCode).toBeUndefined();
});

it("canonicalises a sort the API accepts and rejects everything else", () => {
	// The field is matched ignoring case but written back in the whitelist's
	// camel-case spelling, because `createdAt` is what the API converter knows.
	expect(parseUsersListingQuery({ sort: "createdat,desc" }).sort).toBe(
		"createdAt,desc",
	);
	expect(parseUsersListingQuery({ sort: "NAME,ASC" }).sort).toBe("name,asc");
	expect(parseUsersListingQuery({ sort: "lastLogin,desc" }).sort).toBe(
		"lastLogin,desc",
	);
	// The whitelist is exactly the six documented fields.
	expect(parseUsersListingQuery({ sort: "passwordHash,desc" }).sort).toBe(
		"createdAt,desc",
	);
	// A direction that is not asc/desc is not a sort.
	expect(parseUsersListingQuery({ sort: "name,up" }).sort).toBe(
		"createdAt,desc",
	);
	expect(parseUsersListingQuery({ sort: "name" }).sort).toBe("createdAt,desc");
	expect(parseUsersListingQuery({ sort: "bogus" }).sort).toBe(
		"createdAt,desc",
	);
});

it("offers only whitelisted sort options", () => {
	for (const option of USER_SORT_OPTIONS) {
		expect(parseUsersListingQuery({ sort: option.value }).sort).toBe(
			option.value,
		);
	}
});

it("clamps the page to a sane 1-based number", () => {
	expect(parseUsersListingQuery({ page: "3" }).page).toBe(3);
	expect(parseUsersListingQuery({ page: "0" }).page).toBe(1);
	expect(parseUsersListingQuery({ page: "-2" }).page).toBe(1);
	expect(parseUsersListingQuery({ page: "abc" }).page).toBe(1);
	expect(parseUsersListingQuery({ page: "1.5" }).page).toBe(1);
	expect(parseUsersListingQuery({ page: "999999" }).page).toBe(10_000);
});

it("takes the first value when a parameter is repeated", () => {
	expect(
		parseUsersListingQuery({ keyword: ["alice", "bob"], status: "LOCKED" })
			.keyword,
	).toBe("alice");
});

it("writes only non-default values back to the URL", () => {
	expect(toUsersSearchParams(DEFAULT_USERS_LISTING_QUERY)).toEqual({});

	expect(
		toUsersSearchParams({
			keyword: "alice",
			roleCode: "admin",
			status: "LOCKED",
			sort: "name,asc",
			page: 2,
		}),
	).toEqual({
		keyword: "alice",
		roleCode: "admin",
		status: "LOCKED",
		sort: "name,asc",
		page: "2",
	});
});

it("round-trips through a URL", () => {
	const query = {
		keyword: "alice",
		roleCode: "employee",
		status: "ACTIVE" as const,
		sort: "email,asc" as const,
		page: 3,
	};

	expect(parseUsersListingQuery(toUsersSearchParams(query))).toEqual(query);
});

it("builds the bare path when nothing is filtered", () => {
	expect(toUsersListingHref(DEFAULT_USERS_LISTING_QUERY)).toBe("/admin/users");
	expect(
		toUsersListingHref({ ...DEFAULT_USERS_LISTING_QUERY, status: "LOCKED" }),
	).toBe("/admin/users?status=LOCKED");
});

it("sends a zero-based page and the fixed page size", () => {
	expect(toUsersApiParams(DEFAULT_USERS_LISTING_QUERY)).toMatchObject({
		page: 0,
		size: USERS_PAGE_SIZE,
		sort: "createdAt,desc",
		status: undefined,
	});
	expect(
		toUsersApiParams({ ...DEFAULT_USERS_LISTING_QUERY, page: 4 }).page,
	).toBe(3);
});

it("keeps the customer role in the general query (dev behaviour)", () => {
	expect(parseUsersListingQuery({ roleCode: "customer" }).roleCode).toBe("customer");
	expect(parseUsersListingQuery({ roleCode: "CUSTOMER" }).roleCode).toBe("customer");
});

it("staff mode defaults to the employee role", () => {
	expect(parseStaffUsersListingQuery({})).toEqual(STAFF_DEFAULT_USERS_LISTING_QUERY);
	expect(STAFF_DEFAULT_USERS_LISTING_QUERY.roleCode).toBe("employee");
	expect(DEFAULT_STAFF_ROLE_CODE).toBe("employee");
});

it("staff mode rejects the customer role, case-insensitively", () => {
	for (const spelling of ["customer", "CUSTOMER", "Customer", "cUsToMeR"]) {
		expect(parseStaffUsersListingQuery({ roleCode: spelling }).roleCode).toBe(
			DEFAULT_STAFF_ROLE_CODE,
		);
	}
});

it("staff mode rejects customer while preserving the other filters", () => {
	expect(
		parseStaffUsersListingQuery({
			roleCode: "Customer",
			status: "LOCKED",
			page: "3",
		}),
	).toMatchObject({
		roleCode: DEFAULT_STAFF_ROLE_CODE,
		status: "LOCKED",
		page: 3,
	});
});

it("staff mode keeps an assignable staff role", () => {
	expect(parseStaffUsersListingQuery({ roleCode: "catalog_editor" }).roleCode).toBe(
		"catalog_editor",
	);
	expect(parseStaffUsersListingQuery({ roleCode: "ADMIN" }).roleCode).toBe("admin");
});

it("omits the staff default role from the URL and keeps others", () => {
	expect(
		toUsersSearchParams(
			STAFF_DEFAULT_USERS_LISTING_QUERY,
			STAFF_DEFAULT_USERS_LISTING_QUERY,
		),
	).toEqual({});
	expect(
		toUsersSearchParams(
			{ ...STAFF_DEFAULT_USERS_LISTING_QUERY, roleCode: "catalog_editor" },
			STAFF_DEFAULT_USERS_LISTING_QUERY,
		),
	).toEqual({ roleCode: "catalog_editor" });
});

it("builds the staff href for the compat route", () => {
	expect(
		toUsersListingHref(
			STAFF_DEFAULT_USERS_LISTING_QUERY,
			STAFF_PATH,
			STAFF_DEFAULT_USERS_LISTING_QUERY,
		),
	).toBe("/admin/staff");
	expect(
		toUsersListingHref(
			{ ...STAFF_DEFAULT_USERS_LISTING_QUERY, status: "LOCKED" },
			STAFF_PATH,
			STAFF_DEFAULT_USERS_LISTING_QUERY,
		),
	).toBe("/admin/staff?status=LOCKED");
});

it("redirects the retired roles tab to /admin/roles, case-insensitively", () => {
	expect(rolesTabRedirect("roles")).toBe("/admin/roles");
	expect(rolesTabRedirect("ROLES")).toBe("/admin/roles");
	expect(rolesTabRedirect(" Roles ")).toBe("/admin/roles");
	expect(rolesTabRedirect(["roles"])).toBe("/admin/roles");
});

it("leaves every other staff tab value to the staff view", () => {
	expect(rolesTabRedirect("staff")).toBeNull();
	expect(rolesTabRedirect(undefined)).toBeNull();
	expect(rolesTabRedirect("")).toBeNull();
	expect(rolesTabRedirect("role")).toBeNull();
	expect(rolesTabRedirect(["staff", "roles"])).toBeNull();
});

it("staff mode never reads a keyword from the URL", () => {
	const parsed = parseStaffUsersListingQuery({
		keyword: "alice@example.com",
		status: "LOCKED",
		page: "3",
	});

	expect(parsed.keyword).toBeUndefined();
	expect(parsed).toMatchObject({
		roleCode: DEFAULT_STAFF_ROLE_CODE,
		status: "LOCKED",
		page: 3,
	});
});
