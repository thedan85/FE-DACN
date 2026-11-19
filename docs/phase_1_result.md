# Phase 1 — Admin User Accounts: Result

Status: implemented and verified on branch `midu/accounts`. Nothing committed or pushed.

Phase 1 covers the admin "User accounts" screens: list, detail, add, edit, and bulk actions.
The implementation mirrors the existing admin Products feature and keeps the users code in its
own feature folder so it does not depend on product internals.

---

## 1. Routes

| Route | Screen |
|---|---|
| `/admin/users` | List (tabs, search, filters, bulk actions) |
| `/admin/users/new` | Add user |
| `/admin/users/[userId]` | Detail |
| `/admin/users/[userId]/edit` | Edit |

All four routes live under `src/app/admin/(shell)/users/`. Dynamic `userId` values are URL-encoded
when building links. Sidebar, page titles, and breadcrumbs are wired through the existing admin shell.

---

## 2. Shared foundations changed

| File | Change |
|---|---|
| `src/lib/api/api-error.ts` | New home for `apiErrorMessage` and `isConflict`. |
| `src/lib/api/pagination.ts` | New home for `toApiPage` (1-based UI page to 0-based API page). |
| `src/features/products/admin/model/api-error.ts` | Now a thin re-export, so product code and tests are unchanged. |
| `src/features/products/admin/model/listing-query.ts` | Re-exports `toApiPage`. |
| `src/components/layout/admin-theme.tsx` | Product catalog antd theme promoted to a shared admin theme. |
| `src/features/products/admin/components/admin-catalog-theme.tsx` | Re-exports the shared theme and its old names. |
| `src/components/dialogs/confirm-dialog.tsx` | Optional `danger` prop for destructive confirmation. |
| `src/components/layout/admin-header.tsx` | Optional `parentPage` for a 3-level breadcrumb. |
| `src/components/layout/admin-layout.tsx` | Breadcrumb/page-title rules for the user routes. |
| `src/components/layout/admin-sidebar.tsx` | Routable "User accounts" item (`user-cog`) after "Staff & Permissions". |

"Customers" and "Staff & Permissions" remain inert, as specified.

---

## 3. Users feature

Everything below is under `src/features/users/admin/`.

### Schema and API

- `schema/user.schema.ts` — Zod `UserSummary`, `UserDetail`, `Role`, and page responses. Responses
  are parsed only through `parseOrThrow` and `createPageResponseSchema`; no `any`, no hand-rolled
  field checks.
- `api/users.api.ts` — `listAdminUsers`, `getAdminUser`, `createAdminUser`, `setAdminUserStatus`,
  `setAdminUserRole`, `deleteAdminUser`; paths relative to `NEXT_PUBLIC_API_BASE_URL`, auth headers
  from `getAuthHeaders()`, no `credentials: "include"`, `Accept-Language: en`.
- `api/roles.api.ts` — `listAdminRoles` (`GET admin/roles`, requires `role:read`). Role selectors use
  `code`, never `roleId`.
- Sort values are validated against `email,name,roleCode,status,lastLogin,createdAt` before a request
  is built; an unsupported value is never sent.

### Model helpers

| Module | Responsibility |
|---|---|
| `model/listing-query.ts` | Parse/serialize list URL state; defaults omitted; invalid values rejected. |
| `model/phone.ts` | Strip spaces/dashes/dots/parentheses, validate `/^\+?\d{10,15}$/`, submit stripped value. |
| `model/create-errors.ts` | Split a 400 body on `"field: msg; field: msg"`; classify create 409s. |
| `model/user-api-error.ts` | 409 message mapping, including the stale-role message rewrite. |
| `model/user-status.ts` | Status labels and tones (`ACTIVE` success, `LOCKED` danger). |
| `model/user-format.ts` | `Oct 12, 2026`-style dates (en-US, UTC to avoid hydration drift), member-since text. |
| `model/roles.ts` | Staff role filtering (`customer` excluded) and the static fallback list. |
| `model/user-create-form.ts` | Create validation rules, password advice, request mapping. |
| `model/user-edit.ts` | `userEditChanges` diff for PATCHing only changed fields. |
| `model/use-user-api-failure.ts` | Centralized 401/403/404/connection handling and redirects. |
| `model/permissions.ts` | `USER_PERMISSIONS` (`user:read|create|update|delete`). |
| `use-user-permissions.ts` | Hook exposing those permissions to the screens. |
| `use-admin-roles.ts` | Role list with fallback state. |

### Screens and components

- **List** (`components/users-listing.tsx`): tabs All/Active/Locked, search on submit, role and sort
  filters, no date filter, page size 20, `requestKey` fetch pattern, skeleton, error + retry, and an
  empty state ("No users found" + Clear filters). Footer reads "Showing a-b of N users". Table rows
  show initials avatar + name, email, phone, `roleName` verbatim, a status pill with a visible label,
  and a formatted created date, with view/edit/delete actions. Below 768px the Phone, Role, Status,
  and Created columns collapse.
- **Bulk actions**: current-page selection only; bar reads `N selected | Lock users | Delete selected |
  Clear selection`. Operations run sequentially with a single summary notification listing per-user
  failures. The signed-in user's checkbox is disabled. Already-locked rows are reported as unchanged;
  a 404 during bulk delete is treated as already-deleted.
- **Detail** (`user-detail-screen.tsx`): name, userId, "Member since <createdAt>", Edit/Delete, a
  profile card, and a role & permissions card. No stats, order, or shipping data.
- **Add** (`user-create-form.tsx`): personal information (name required ≤255, valid email ≤255,
  optional phone and address), role (staff roles only, default `employee`, no status field), password
  with show/hide and a strength meter, and a sticky Cancel/Create footer. No avatar.
- **Edit** (`user-edit-screen.tsx`): personal information is read-only; only Role and Status are
  editable and saved sequentially (role PATCH, then status PATCH). A partial failure keeps the form,
  reports what saved, and refreshes from the last successful response. Own row and `customer` targets
  are locked. "Unsaved changes" and "Password changes are managed by the user" are shown.
- **Delete** (`user-delete-dialog.tsx`): shared by list and detail, using `ConfirmDialog` with a
  danger confirm button and a loading lock. Copy states that access is removed, order history is
  kept, and the email cannot be reused. No order counts. Deleting your own account is disabled with a
  tooltip. Deletion is soft.

### Error handling

| Case | Behaviour |
|---|---|
| 401 | Clear session, set the auth store anonymous, warn "Your session has ended", redirect to `/admin/login`. |
| 403 | "You don't have permission to do this". |
| 404 on detail/edit | Route-level `Result` 404. |
| Network failure (status 0) | Connection message with retry where applicable. |
| Create 400 | Split the body onto matching fields (`roleCode` → `role`); unparsed text becomes a form alert. |
| Create 409 | Field error when the message matches `/email/i`, otherwise a form alert. |
| Status/role/delete 409 | Backend message in the notification, except a stale role message, which becomes "The selected role is not available. Refresh and try again." |
| Double submit | Guarded on every mutating screen. |

If `GET admin/roles` fails, the role selectors fall back to static `employee`/`admin` with a hint, and
role editing is hidden on Edit. Permission checks only hide UI; the backend remains authoritative.

---

## 4. Tests

Colocated Vitest suites cover:

- List query parsing/serialization and defaults.
- Phone normalization.
- 400 body splitting and 409 message classification.
- User and role API modules: URL construction, headers, response parsing, sort whitelist.
- `useUserPermissions`.
- Create and edit request mapping (`user-create-form`, `user-edit`).
- Listing (including bulk failure summary and the disabled self checkbox).
- Detail, create, and edit screens.

---

## 5. Verification

Run on Windows with `cmd.exe /c "npm.cmd run ..."`:

| Command | Result |
|---|---|
| `npm run check` | Exit 0 — eslint clean, `lint:antd` 232 files clean, `tsc --noEmit` clean, CSS-module check clean, encoding check clean, **43 test files / 273 tests passed**. |
| `npm run build` | Exit 0 — all four user routes generated (`/admin/users`, `/admin/users/[userId]`, `/admin/users/[userId]/edit`, `/admin/users/new`). |

`npm run check` run directly from PowerShell can report a failure caused by jsdom's
`getComputedStyle()` stderr warnings rather than by a real test failure; `cmd.exe` avoids the
misleading exit code.

---

## 6. Deliberate choices and limitations

- Deleting your own account is **disabled with a tooltip** instead of hidden, because a hidden control
  cannot explain why the action is unavailable.
- `Form.useWatch` drives the live UI: the create screen's password meter and the edit screen's
  "Unsaved changes" indicator and helper copy read the form itself, so they agree with what Save
  would send. (An earlier version mirrored values through `onValuesChange` after a misdiagnosed
  `useWatch` failure; the real cause was a form instance used before its `<Form>` had mounted.)
- The edit form mounts only after the account loads and owns its own store, seeded from
  `initialValues`; retries/account changes get a fresh child component. `clearOnDestroy` is not
  used because Strict Mode effect replay clears seeded values. Partial failures retain the draft.
- Password strength stays below "Strong" unless the password also meets the 12-character
  recommendation; the hard rule remains 8–128.
- Role editing is disabled when the target is the signed-in user, when the target role is `customer`,
  or when the role list is a fallback.
- Dates render in en-US UTC to keep server and client output identical.

Out of scope for Phase 1: roles/permissions management screens (Phase 2), order statistics,
avatars/photos, and any backend change.

---

## 7. Repository state

All Phase 1 work is uncommitted on branch `midu/accounts`; nothing was committed or pushed.

Pre-existing working-tree state, left untouched: deleted `.env.example`, and untracked
`FE_CONTEXT.md`, `FE_STATUS.md`, `docs/admin-api-contract.md`, `docs/admin-roles-api.md`, and
`docs/admin-users-api.md`.
