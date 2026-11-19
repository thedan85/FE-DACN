# Phase 2 — Roles & Permissions: Result

Implemented on `midu/accounts`. Nothing committed or pushed.

## Routes and navigation

| Route | Screen |
|---|---|
| `/admin/roles` | Roles list with local search |
| `/admin/roles/new` | Add role |
| `/admin/roles/[roleId]` | Role information and permissions editor |

The existing **Staff & Permissions** sidebar item now routes to `/admin/roles` and stays visible
regardless of permissions. Customers remains inert. Titles and three-level detail/add breadcrumbs
are wired into the existing admin shell.

## Implementation

Code lives under `src/features/roles/admin/{api,schema,model,components}` and uses the shared admin
theme, token-based CSS Modules, antd v6 controls, cards, badges, and sticky save bars. There are no
imports from the users or products features.

### Contract and API

- Added `listRoles`, `getRole`, `createRole`, `updateRole`, `replaceRolePermissions`, `deleteRole`,
  and `listPermissions`, following `docs/admin-roles-api.md`.
- Requests use the centralized API client, `getAuthHeaders()`, and `Accept-Language: en`, without
  `credentials: "include"`. Responses use Zod through `parseOrThrow`.
- Identifiers are opaque. Both route links and API paths encode the returned ID; no ID is derived
  from a code or checked for a prefix. PUT sends unique **permission IDs**, never codes.
- Nullable display fields, descriptions, and timestamps are accepted. Missing role names fall back
  to the code; missing descriptions display **No description**. Timestamps remain plain strings.
- The users feature's existing `listAdminRoles` API remains unchanged.

### List

- Preserves API order; searches the loaded array by name/code without extra requests.
- Shows name/description, monospace code, System/Custom badge, updated date, View, View users, and
  Delete controls. Clicking a row opens its detail; the role name is also a keyboard-accessible link.
- Includes loading, no-access, error/retry, empty/search-reset, and table-footer states.
- System deletion is disabled with an explanatory tooltip. No invented usage/permission counts or
  per-role detail fetches were added.

### Detail and permissions editor

- A child component owns its single Form instance and mounts only after role/catalog data loads.
  Values are seeded with `initialValues`; `Form.useWatch` drives the live change indicator.
- Role information edits name/description only. Code is read-only and immutable.
- Permission checkboxes are grouped by sorted resource, with selected counts and Select all/Clear.
  Unknown future resources/actions are handled generically.
- Admin user/role permissions stay checked and disabled and are included in the replacement set.
  Customer permissions are read-only; its name/description can still be edited.
- Without `role:update`, the editor is read-only. Without `role:read`, no protected reads occur.
- Saves PATCH changed information first, then PUT the full selection only when changed. Successful
  responses update the baseline; partial failure preserves the remaining draft and explains what saved.
- A legacy null/empty name may stay unchanged for permission-only or description-only updates. New
  roles and actual name changes still require a nonblank name; no blank name PATCH is sent.
- Cancel resets to the last successful response. Reload/close and ordinary link navigation warn about
  unsaved changes.
- Permission-not-found responses refresh the catalog and prompt review. Removed IDs are not
  reintroduced by old admin grants.

### Add, delete, and own-role changes

- Add validates the code pattern, required name (255 characters), and optional description
  (2000 characters). Success uses the returned ID and displays:
  **Role created. Now choose its permissions.**
- Delete uses the danger `ConfirmDialog`, explains soft deletion and permanent code reservation,
  and returns to the list after success. System roles are guarded in the dialog too. Backend 409
  messages are shown without rewriting the business rule.
- Editing one's own permissions requires confirmation before writes. Any successful own-role save,
  including partial success, refreshes `getMe()` and calls the auth store's `setUser()`.
- Losing `role:read` produces an info message and redirects to `/admin/dashboard`. If access refresh
  fails, further mutations are blocked with a **Refresh access** retry rather than trusting stale UI.
- Mutation flows have immediate ref-based double-submit guards.

## Shared changes and Phase 1 compatibility

- Promoted the common failure classifier to `src/lib/api/admin-api-error.ts` and its session/redirect
  hook to `src/hooks/use-admin-api-failure.ts`. Old users paths retain compatible re-exports.
- Promoted the UTC admin date formatter to `src/lib/utils/admin-date.ts`; users retain the old
  `formatUserDate` export.
- 401 clears the local session/store and redirects to admin login without calling logout; 403,
  404, connection, validation, and business-rule failures retain their distinct handling.
- No backend, dependency, global-theme, or user-assignment changes were made.

## Verification

| Check | Result |
|---|---|
| `npm run check` | Exit 0 — lint, antd lint, typecheck, CSS modules, encoding, **57 test files / 372 tests passed**. |
| `npm run build` | Exit 0 — all three roles routes generated; existing users routes retained. |
| Browser flows | **9/9 passed** in headless Microsoft Edge against Next dev, using intercepted API fixtures. |
| Browser console | **No warnings, console errors, or page errors** in those flows. |
| Shared database | **Zero live backend requests or database writes** during browser verification. |

Colocated tests cover seeded `role-admin`, nullable descriptions/display fields, opaque ID transport,
resource grouping, selection diffs, locked admin grants, validation/request mapping, error mapping,
API headers/URLs/parsing, permission-hook changes, all screens' gates, partial saves/retry, catalog
refresh, own-role confirmation/auth refresh, and delete rules.

### Final review fixes

The read-only review identified three edge cases, each reproduced by a failing regression test
before correction:

1. Permission-catalog recovery now reconciles both the draft and persisted baseline, so Cancel
   cannot restore a deleted permission ID into a subsequent save.
2. A missing permission is recognized by the documented `permission not found:` message prefix,
   not by a word inside an opaque role ID such as `ROLE_permissions-manager`.
3. An unchanged legacy null/empty name no longer blocks an independent permissions update.

An additional regression ensures read-only admin viewers do not get an unsaved-change warning
for automatically checked mandatory grants. There were no deferred minor findings.

Browser checks covered list/detail/Add direct loads, reloads and navigation; live selection diffs;
unsaved-link confirmation; PATCH-before-PUT; admin/customer locks; create/delete; and own-role
permission loss. Desktop and 390px screenshots were inspected.

## Version-specific decision and limitations

- Browser verification exposed a Next 16.4.3 behavior different from the earlier Phase 1 assumption:
  `get-dynamic-param.js` encodes the value passed to page code. The roles page decodes that **URL
  transport layer once**, before the API re-encodes the opaque ID. Tests include literal `%2F` IDs
  to prevent accidental double decoding. Phase 1 routes were not modified.
- At 390px, verification used the existing sidebar collapse control. The shared admin shell does not
  automatically collapse on mobile; its navigation/header redesign is outside Phase 2.
- Unsaved-change protection does not intercept every browser Back/Forward or programmatic navigation;
  the App Router has no general navigation-blocking API.
- Browser API behavior was mocked; this is not a claim of live backend CRUD verification. Existing
  jsdom `getComputedStyle` warnings remain in unit-test output but do not fail the gate.

Pre-existing working-tree changes, including the `.env.example` deletion and Phase 1 work, were
preserved. Nothing was staged, committed, or pushed.
