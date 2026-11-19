# Frontend QA fixes v1

Date: 2026-11-19

Status: complete. All five approved frontend fixes from `test_status.md` are implemented and verified.

## Checklist

- [x] Inspect QA findings, affected flows, existing tests, and working-tree changes.
- [x] Confirm the bounded approach with the user.
- [x] Add failing regressions and fix silent truncation and password byte validation.
- [x] Add a deferred-delete regression and disable Cancel while pending.
- [x] Test and fix role-selector permission gating and session-expiry handling.
- [x] Test and fix HTTP rejection handling during auth revalidation.
- [x] Test and fix user-edit read/update gating.
- [x] Review the scoped diff and run `npm run check` and `npm run build`.
- [x] Record final changes, verification results, and limitations here.

## Changes

### 1. Silent truncation — ADD-08/13, RA-02/06, user name/email

- Removed native `maxLength` from user-create name, email, password, and address, role-create code, and shared role name/description fields (create and edit).
- Kept field validators and added length helper text. Over-length values remain in the input, produce an inline error, and prevent the submit handler/API call.
- Password validation requires at least 8 characters and at most **72 UTF-8 bytes**, measured with `TextEncoder`. The password is never trimmed or truncated. The validation message is:

  > Password must be 8–72 bytes (about 72 characters, fewer if it has accented or non-Latin characters).

- Added an explicit role-code maximum-length branch: `Code must be 2–50 characters.` Invalid syntax retains its separate message.

Files:
- `src/features/users/admin/model/user-create-form.ts`
- `src/features/users/admin/components/user-create-form.tsx`
- `src/features/roles/admin/model/role-form.ts`
- `src/features/roles/admin/components/role-create-form.tsx`
- `src/features/roles/admin/components/role-information-fields.tsx`

### 2. Pending delete — DEL-03

`src/components/dialogs/confirm-dialog.tsx` now passes `cancelButtonProps={{ disabled: confirmLoading }}`. OK retains its loading indicator. Existing duplicate-submit, cancel, close, mask, and Escape guards remain unchanged.

### 3. Role selector authorization and 401

`src/features/users/admin/use-admin-roles.ts` now:
- Calls `listAdminRoles` only with `role:read`.
- Uses static staff options without a request when a signed-in account lacks that permission.
- Routes 401 through `useAdminApiFailure`, clearing the token and cached identity and redirecting to `/admin/login`; it does not offer fallback options to an anonymous session.
- Retains fallback for 403, transport failures, and malformed response contracts. Unexpected HTTP failures are surfaced with a message instead of being silently converted to static options. A successful empty response stays empty.
- Ignores an in-flight result after permission loss/unmount.

### 4. Auth revalidation

`src/stores/auth-store.ts` now clears a previously cached user and sets `status: "anonymous"` when revalidation ends in HTTP 401/403. `sessionReady` becomes true and the access token is cleared.

Existing refresh-cookie recovery is preserved: an expired access token can still recover if refresh and the subsequent profile read succeed. Status-0 behavior is unchanged: clear the access token, retain an already resolved identity/status, or resolve anonymous if there was no confirmed identity.

### 5. User-edit access

`src/features/users/admin/components/user-edit-screen.tsx` now requires both `user:read` and `user:update` before fetching or displaying the edit form. The no-access message identifies both permissions, and revoking read access hides an already-loaded form.

## Regression coverage

Tests exercise real forms/dialogs/hooks/store; API calls and navigation are stubbed. No live backend data was changed.

- Over-length change events: visible field errors, unchanged values, and no create/update API calls.
- Explicit absence of native `maxlength` on all affected user/role inputs, including shared fields on role edit. This catches the browser-truncation configuration that jsdom change events alone cannot detect.
- Password boundaries: 8/72 ASCII characters, accented two-byte characters, three-byte CJK characters, four-byte emoji, and short non-ASCII values.
- Deferred deletes: double confirm sends one request; Cancel is disabled while pending; cancellation/Escape do not close the pending dialog; success callbacks fire once; rejection restores Cancel and leaves the dialog available.
- Role selector: permission gate, successful response, 401 clear/redirect, each fallback class, unexpected server error, empty response, and permission loss during a pending read.
- Revalidation: 401/403 at refresh/profile stages, failed access plus refresh, successful expired-token recovery, and status 0 with/without a resolved identity.
- User-edit: update-only access makes no account request; revoking read access removes the form. Existing role-selection tests now explicitly grant `role:read` where an API-backed role list is required.

Changed/added test files:
- `src/features/users/admin/model/user-create-form.test.ts`
- `src/features/users/admin/components/user-create-form.test.tsx`
- `src/features/users/admin/components/user-delete-dialog.test.tsx`
- `src/features/users/admin/components/user-edit-screen.test.tsx`
- `src/features/users/admin/use-admin-roles.test.tsx`
- `src/features/roles/admin/model/role-form.test.ts`
- `src/features/roles/admin/components/role-create-form.test.tsx`
- `src/features/roles/admin/components/role-detail-screen.test.tsx`
- `src/stores/auth-store.test.ts`

## Verification

Failing regressions were run before production fixes: native-cap/password/code tests reproduced the validation defects; permission/auth tests reproduced stale-session and gate failures; the deferred-delete tests reproduced enabled Cancel while pending.

| Command | Final result |
| --- | --- |
| `npm.cmd run check` | **PASS**, exit 0: ESLint, Ant Design lint, typecheck, CSS-module check, UTF-8/encoding check, and **444 tests / 61 files**. |
| `npm.cmd run build` | **PASS**, exit 0 on retry: production compilation, TypeScript, and generation of all 23 static pages completed. |

Windows command shims were used without changing PowerShell execution policy. An earlier check attempt exceeded the tool's 120-second limit; the final full check above completed with a larger timeout.

Read-only code review approved the five fixes with no critical, important, or minor findings. The review accepted preservation of refresh-cookie recovery and existing JavaScript character-length semantics. Its excluded areas match the explicitly out-of-scope work below; build and test results were verified by the implementing agent, not rerun by the reviewer. `git diff --check` also completed successfully.

### Warnings and limitations

- **Next.js 16.4.3 reports a known security vulnerability and recommends an upgrade.** The first build stopped at its one-time advisory; the same command succeeded on retry and still printed the warning. No dependency upgrade was made: coordinate a separate security update rather than broadening this fix.
- jsdom prints non-fatal `getComputedStyle` pseudo-element warnings from Ant Design. The final suite has zero test failures. No browser paste/manual visual verification was performed; native-cap assertions supplement jsdom's over-length event tests.
- The backend request documentation still describes an 8–128-character password DTO. This frontend deliberately applies the requested stricter bcrypt byte limit; the backend and its contract documentation were not changed.
- LIST-09 history policy, UI-05 responsive shell, backend behavior, and periodic permission refresh remain out of scope.
- Existing unrelated working-tree changes were preserved. No commit or push was performed.
