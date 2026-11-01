import type { MeData } from "../types";

/**
 * The backend's own discriminator: `AuthService` compares the role code with
 * `equalsIgnoreCase("CUSTOMER")`, and Customer is the only role without portal
 * access (ADR-0001).
 */
const CUSTOMER_ROLE_CODE = "CUSTOMER";

/**
 * `GET auth/me` returns the stored role code verbatim (`customer`, `admin`, …),
 * not the upper-case spelling the ADR writes, so the comparison folds case to
 * stay aligned with the server's own check.
 */
export function isCustomerAccount(roleCode: string): boolean {
	return roleCode.toUpperCase() === CUSTOMER_ROLE_CODE;
}

/**
 * The portal boundary, as a single exclusion rather than a role allow-list:
 * any account that is not a Customer belongs in the portal, so a future
 * internal role gains access without this function changing.
 */
export function isCompanyAccount(user: MeData | null): boolean {
	return user !== null && !isCustomerAccount(user.roleCode);
}
