# Admin portal serves all company accounts, with email/password only

The admin portal — the design says "STORE ADMIN" — is open to every **company account** (any role except Customer), not just Admin, and those accounts sign in with email and password only. The backend deliberately rejects Google sign-in for non-customer accounts (`"Google sign-in is only available for customer accounts; use email and password"`), and one back-office for all internal roles beats two portals navigating the same pages.

## Considered Options

- **Admin-only portal** (`roleCode === "ADMIN"`), Staff handled separately later — rejected: duplicate shell, navigation, and login for the same back-office tasks.
- **Google sign-in for company accounts** — not possible without backend changes; the API enforces email/password for non-customers by design.

## Consequences

- The guard is a single exclusion (`roleCode !== "CUSTOMER"`): any future internal role gains portal access automatically. New *privileged* roles must therefore be granted deliberately elsewhere — the portal boundary is a floor, not a privilege list.
- Sidebar navigation is role-agnostic for now; role-based visibility returns as a real decision when pages behind those items exist.
