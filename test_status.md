# Admin Account Management & RBAC — Frontend Investigation

**Scope:** read-only inspection of the current working tree on `midu/accounts`, plus the historical browser QA record in `.scratch/accounts-roles-browser-qa/report.md`. No source, test, config, dependency, or database change was made. Nothing was committed or pushed.

**Verification performed:** the existing hermetic suite for these areas was run with mocked API boundaries:

```
npm.cmd run test -- src/features/users/admin/... src/features/roles/admin/... src/stores/auth-store.test.ts src/lib/api/admin-api-error.test.ts --maxWorkers=2
→ Test Files 10 passed (10)
→ Tests      106 passed (106)
→ Duration   53.72s
```

The command completed without an error exit. This proves the current behaviour is *tested*, not that it is *correct*; several gaps below are precisely behaviours the suite cannot see.

**Evidence limits**

- Backend source at `D:\VSCode\UniProjects\DACN` is not present on this machine, so backend token-invalidation internals could not be read. `GET http://localhost:8080/v3/api-docs` was read (no writes) and confirms the declared field constraints.
- No authenticated browser flow was re-run. UI-05 uses the historical screenshots and measured CSS; UI-01 was not reproduced. No production build/server was started, so production CSS behaviour is unverified.

---

## Summary

| ID | Defect | Responsibility | Severity | Confidence |
|---|---|---|---|---|
| ADD-08 | Overlong password silently truncated by native `maxLength`; no feedback | FRONTEND | **P1 / High** | High |
| ADD-13 | Overlong address silently truncated; no feedback | FRONTEND | P2 / Medium | High |
| RA-02 | Overlong role code silently truncated; role created with altered, permanent code | FRONTEND | **P1 / High** | High |
| RA-06 | Overlong role name/description silently truncated; role saved | FRONTEND | P2 / Medium | High |
| DEL-03 | Dialog buttons expose no disabled semantics while a delete is pending | FRONTEND (UX/a11y only) | P3 / Low | High |
| LIST-09 | Back cannot restore the previous page because every query change uses `replace` | FRONTEND (policy decision) | P2 / Medium | High |
| UI-05 | Sidebar/workspace not responsive; table and header clip below ~1024px | FRONTEND | P2 / Medium | High |
| UI-01 | Dev-only CSS preload warning on `/admin/roles` | UNCONFIRMED (Next dev tooling) | P3 / Low | Low |
| INT-04 | A pre-lock access token is accepted again after unlock | **BACKEND** | **P1 / High** | High (for backend) |

A tenth issue, not in the checklist but found during the RBAC review, is recorded in §3.1: the Users role selector converts every failure — including a 401 — into fallback options, so it never triggers the shared session-expiry path.

---

## 1. Reported issues

### ADD-08 — Overlong password is silently truncated

| Field | Detail |
|---|---|
| Test case | ADD-08 (P1) |
| Root cause | **Confirmed.** `Input.Password` is given the native `maxLength` cap, so the browser truncates a pasted 129-character password to 128 *before* React sees it. The password validator therefore compares 128 characters, passes, and the account is created with a different secret than the user pasted. |
| Responsibility | FRONTEND |
| Severity | P1 — the user is locked out of the account they just created, and the UI report gives no indication the secret changed. |
| Confidence | High |

**Evidence**

- `src/features/users/admin/components/user-create-form.tsx:395–399` — `<Input.Password maxLength={PASSWORD_MAX_LENGTH} …>`; the cap is the only feedback mechanism (no `showCount`, no counter).
- `src/features/users/admin/model/user-create-form.ts:22–23,82–92` — the validator that would produce `"Password must be 8–128 characters."` is unreachable for the overlength case, because the value never exceeds 128.
- Truncation is native, not rc-component trimming: `node_modules/@rc-component/input/es/Input.js:145–171` forwards `maxLength` to the real `<input>`, and `node_modules/@rc-component/input/es/hooks/useCountExceed.js:17–28` only trims when `countConfig.max` is configured (it is not — only `showCount`/`count` would set it). Ant Design's Input has no `maxLength` handling of its own.
- No compensating client guard: `handleFinish` validates via `values` only (`user-create-form.tsx:125–135`), and `toCreateAdminUserInput` sends the password unchanged (`user-create-form.ts:193–205`). Nothing records the pre-truncation length.
- Backend contract: `POST /admin/users` declares `@Size(min=8,max=128)` (`docs/admin-api-contract.md:344`), and OpenAPI reports `password: minLength 8, maxLength 128`. The backend would have rejected 129 characters with a mapped field error; the frontend prevents that request from ever carrying the real input.

**Recommended fix**

- Remove `maxLength` from the password control and let the existing validator reject overlength values with its existing message; optionally add `showCount` so the limit is visible before submit.
- Apply the same treatment to every field in this form that relies on `maxLength` (name `269`, email `295`, address `345`) to avoid re-litigating the same defect per checklist row.
- On rejection, keep the value intact and show the field error — never silently rewrite a credential.

**Backend dependencies:** none. The contract already rejects overlength input; only the frontend policy (silent cap vs. visible error) needs to change.

**Regression tests**

- Component test: fire a change event with `"a".repeat(129)` (jsdom does not enforce `maxLength`, so this reaches the validator), submit, assert the field error is rendered and `createAdminUser` was not called.
- Component test asserting the password control has **no** `maxLength` attribute once the fix lands, so a future edit cannot reintroduce the silent cap.
- Add a red-green check: revert the fix and confirm the new test fails because the payload is truncated/accepted.

---

### ADD-13 — Overlong address is silently truncated

| Field | Detail |
|---|---|
| Test case | ADD-13 |
| Root cause | **Confirmed.** Same mechanism: `Input.TextArea maxLength={255}` truncates the paste, and `validateUserAddress` only ever sees ≤255 characters. |
| Responsibility | FRONTEND |
| Severity | P2 — optional field; stored address is silently altered, which matters for delivery/contact copy. |
| Confidence | High |

**Evidence**

- `src/features/users/admin/components/user-create-form.tsx:327–350` — custom validator plus `<Input.TextArea rows={2} maxLength={USER_ADDRESS_MAX_LENGTH}>`; no `showCount`.
- `src/features/users/admin/model/user-create-form.ts:94–99` — validator returns `"Address must be 255 characters or fewer."` only when `value.trim().length > 255`, which cannot occur through the UI.
- Truncation is native for the textarea too: `node_modules/@rc-component/input/es/TextArea.js:170–188` passes `maxLength` to the textarea element; `useCountExceed` again requires a configured `count`.
- Payload side is clean: `user-create-form.ts:193–205` trims and omits blank addresses, but never slices; `users.api.ts` serializes unchanged input. So the loss happens exclusively at the control.
- Contract: `address` is `@Size(max=255)` and blank becomes `null` (`docs/admin-api-contract.md:347`); OpenAPI confirms `maxLength 255`.

**Recommended fix:** remove the native cap, keep the existing validator, and show the limit as helper text or a counter.

**Backend dependencies:** none.

**Regression tests:** change-event test with 256 characters asserting the address error and no `createAdminUser` call; edit-screen equivalent once a profile-update endpoint exists (there is none today — the edit screen is read-only for profile fields).

---

### RA-02 — Overlong role code is silently truncated

| Field | Detail |
|---|---|
| Test case | RA-02 (P1) |
| Root cause | **Confirmed.** `Input maxLength={50}` truncates the pasted code to 50 characters; the 50-character prefix still matches `^[A-Za-z][A-Za-z0-9_]{1,49}$`, so validation passes and the role is created under a code the user never chose. Because codes are immutable and survive soft delete, the altered code is permanent. |
| Responsibility | FRONTEND |
| Severity | P1 — a durable identity change, exactly the class of silent data alteration the checklist targets. The historical QA fixture was created this way and had to be cleaned up. |
| Confidence | High |

**Evidence**

- `src/features/roles/admin/components/role-create-form.tsx:61–63` — code `Form.Item` combines the pattern validator with `<Input maxLength={50}>`.
- `src/features/roles/admin/model/role-form.ts:4,8–10` — `ROLE_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,49}$/`; `validateRoleCode` trims then tests, so a truncated 50-character prefix passes.
- `role-create-form.tsx:32–45` — `save` sends `toCreateRoleInput(values)` and only maps 400/409 after the request; there is no pre-submit length comparison against the original paste.
- `role-form.ts:20–21` — `toCreateRoleInput` trims `code` and sends it; no length check.
- Contract: role code is 2–50 with that pattern (`docs/admin-api-contract.md`, role-create section; live OpenAPI reports `maxLength 50`), and `code`/`system` are immutable afterwards (`docs/admin-api-contract.md:933–934`).
- Historical evidence: `.scratch/accounts-roles-browser-qa/report.md:18` — "Overlong code silently truncated to 50 and a role with the truncated code could be created."

**Recommended fix:** same class as ADD-08 — remove the native `maxLength` on the code input, keep the pattern/length validator, and add an explicit maximum-length branch to `validateRoleCode` (currently length is only enforced indirectly by the regex, which makes the error message ambiguous). A code input is a good candidate for `showCount`.

**Backend dependencies:** none; the backend already enforces 50 characters and the pattern.

**Regression tests:** validator unit test for a 51-character value that *starts with a letter* (the current tests do cover `"a".repeat(51)` at `role-form.test.ts:12`, which proves the rule exists but not that the UI can deliver such a value); plus a component test with a 60-character change event asserting the field error and no `createRole` call.

---

### RA-06 — Overlong role name and description are silently truncated

| Field | Detail |
|---|---|
| Test case | RA-06 |
| Root cause | **Confirmed.** Shared role fields cap name at 255 and description at 2000 natively, so the shared validators never see the overlength value; both create and edit then save the truncated text. |
| Responsibility | FRONTEND |
| Severity | P2 — content is silently altered; no identity change (unlike RA-02). |
| Confidence | High |

**Evidence**

- `src/features/roles/admin/components/role-information-fields.tsx:9–18` — name `Input maxLength={255}`, description `Input.TextArea maxLength={2000}`, each with a custom validator.
- `src/features/roles/admin/model/role-form.ts:11–19` — `validateRoleName` (`value.length > 255`) and `validateRoleDescription` (`value.length > 2000`) are unreachable for pasted input.
- `role-form.ts:23–27` — `roleInformationPatch` compares and sends trimmed values without slicing, so again the loss is at the control.
- The same component is reused by create (`role-create-form.tsx:64`) and edit (`role-editor.tsx:162`), so one fix covers both screens.
- Contract: `name` `@Size(max=255)`, `description` `@Size(max=2000)` (`docs/admin-api-contract.md:948–949`, and the role-create table).

**Recommended fix:** remove both native caps, keep the validators, and add a counter or helper text (`description` already advertises "Up to 2000 characters" as `extra`, which makes the silent cap more misleading).

**Backend dependencies:** none.

**Regression tests:** change-event tests with 256-character name and 2001-character description asserting the shared field errors and no save request; a create-form and an editor-form variant because the fields are shared but the submission paths differ.

---

### DEL-03 — Delete dialog remains interactive during submission

| Field | Detail |
|---|---|
| Test case | DEL-03 |
| Root cause | **Partially confirmed, but not a duplicate-submission defect.** The buttons do not expose `disabled`/`aria-disabled`, so a DOM/accessibility check sees "interactive"; duplicate submission is nevertheless prevented by handler guards and Ant Design's loading button. This is a UI-semantics mismatch, not an unguarded delete. |
| Responsibility | FRONTEND (UX/accessibility) |
| Severity | P3 |
| Confidence | High that no duplicate DELETE or unguarded cancel exists; high that the semantics are wrong. |

**Evidence**

- `src/components/dialogs/confirm-dialog.tsx:32–46` — sets `confirmLoading`, `closable={!confirmLoading}`, `keyboard={!confirmLoading}`, `mask={{ closable: … }}`. It passes no `okButtonProps.disabled` or `cancelButtonProps`, so the Cancel button's `disabled` attribute stays `false`, and the OK button is "loading", not "disabled".
- Ant Design internals confirm the *behaviour* is still safe: `node_modules/antd/es/button/button.js:179–186` returns early when `innerLoading || mergedDisabled`, and `node_modules/antd/es/modal/components/NormalOkBtn.js:21` maps `confirmLoading` to `loading`. `NormalCancelBtn.js:8–17` passes only `cancelButtonProps`, i.e. nothing.
- Application guards independently prevent double work:
  - single delete: state guard `if (target === null || deleting) return` and cancel ignored while deleting (`user-delete-dialog.tsx:45–50,92–104`);
  - bulk delete: same state pattern (`users-bulk-delete-dialog.tsx:45–50,121–133`);
  - role delete: `busy` ref plus re-check of role/system/permission (`role-delete-dialog.tsx:20–26,41–43`).
- Historical QA recorded `disabled=false` **while a real DELETE was held pending**, and explicitly noted it was "not proof of duplicate DELETEs or an unguarded cancel callback" (`.scratch/accounts-roles-browser-qa/report.md:17`).

**Recommended fix**

- In `ConfirmDialog`, pass `cancelButtonProps={{ disabled: confirmLoading }}` (cancel already does nothing while pending, so disabling it states the truth) and keep the mask/closable behaviour.
- Consider `okButtonProps={{ disabled: confirmLoading }}` alongside `confirmLoading` so assistive technology and automated checks see the busy state, not only a spinner.
- If "cancel should abort the request" is the intended product behaviour, that needs an `AbortController` threaded through the API layer — a larger change than the checklist requires and not needed to fix DEL-03.

**Backend dependencies:** none.

**Regression tests**

- Component test with a deferred `deleteAdminUser` promise: click Confirm twice, then resolve; assert exactly one call, `Cancel`/`No` is disabled while pending, and closing is a no-op until settlement.
- Same for the role and bulk dialogs (they use ref guards, so a single shared test helper is worthwhile).
- Error-path test: reject after clicking Cancel; assert the dialog is still open, the busy state resets, and a retry is possible.

---

### LIST-09 — Browser Back does not restore the previous pagination state

| Field | Detail |
|---|---|
| Test case | LIST-09 |
| Root cause | **Confirmed and intentional.** The listing writes every query change — including pagination — with `router.replace`, so no history entry is created and Back leaves the admin section entirely. |
| Responsibility | FRONTEND (product/UX decision, not a framework bug) |
| Severity | P2 |
| Confidence | High |

**Evidence**

- `src/features/users/admin/components/users-listing.tsx:177–190` — `updateQuery` always calls `router.replace(...)`, resetting selection first.
- Pagination wires straight into it: `users-listing.tsx:558–567` — `onChange={(next) => updateQuery({ page: next })}`.
- The file's own comment (`users-listing.tsx:73–76`) justifies `replace` by "typing a search term does not fill the history stack with every keystroke" — but the keyword is committed on submit, not per keystroke (`users-toolbar.tsx`, `onKeywordSubmit`), so the stated reason applies to the *toolbar inputs*, not to pagination. Fields commit on change for the selects, but not per-keystroke.
- The catalog listing has the same convention and the same comment: `src/features/products/admin/components/products-listing.tsx:56–59,188–198,428`, so this is a project-wide navigation convention rather than a users-module slip.
- Next.js behaviour is not at fault: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md` documents `router.push` as adding a history entry and `router.replace` as replacing the current one.
- Historical QA: `.scratch/accounts-roles-browser-qa/report.md:14` — "Browser Back from page 2 returned to storefront `/`, not page 1."

**Assessment:** a functional checklist failure against a deliberate implementation choice. It is *not* a bug in the sense of broken code, but it is also not harmless: a paginated admin list is exactly where users expect Back to step through pages, and the current comment over-generalises a keystroke concern into a pagination decision.

**Recommended fix (needs approval, because it changes a shared convention)**

1. Adopt an explicit policy: `push` for discrete navigation (page, tab, sort, role filter, submitted keyword) and `replace` for transient refinement (no per-keystroke writes exist today, so this is mostly moot).
2. Implement it once in the query-update helper (`updateQuery(next, { history: "push" | "replace" })`) and reuse it in the catalog listing, so the two modules do not diverge.
3. Keep `replace` for "Clear filters" and for normalising an invalid URL on mount.

**Backend dependencies:** none.

**Regression tests**

- Component test asserting `router.push` is called for `Pagination.onChange` and for a tab change, and that `router.replace` is used for clear-filters.
- E2E (Playwright, hermetic route/mocked API): go to page 2, `goBack()`, assert page 1 rows and the URL query; then `goForward()`.
- Avoid asserting Next.js internals; assert the router call and, in E2E, the restored UI state.

---

### UI-05 — Responsive layout issues

| Field | Detail |
|---|---|
| Test case | UI-05 |
| Root cause | **Confirmed.** The admin shell has no responsive mode: a permanently 224px sidebar, fixed 28px main padding, a fixed-width header search that wins the cascade over its own media rule, and a users table with no horizontal scroll container while its `md` breakpoint is evaluated against the *viewport*, not the remaining workspace. |
| Responsibility | FRONTEND |
| Severity | P2 — no data loss, but the Users screen is unusable at 768px wide and effectively inaccessible at phone widths unless the sidebar is collapsed manually. |
| Confidence | High |

**Evidence**

- Shell: `src/components/layout/admin-layout.tsx:79–107` — collapse state starts `false` and nothing observes viewport width; `admin-layout.module.css:1–20` — `height: 100vh; overflow: hidden`, `.main { padding: 28px }` with no mobile override.
- Sidebar: `admin-sidebar.module.css:1–15` — `width: 224px; flex-shrink: 0`, collapsed mode 72px, no off-canvas/drawer mode and no breakpoint at which it starts collapsed.
- Header: `admin-header.module.css:7–13` — `.bar { gap: 24px; overflow: hidden }` clips content rather than wrapping; `44–58` — `.search` and `.search:global(.ant-input-affix-wrapper)` both hard-code `width: 260px; flex-shrink: 0`; the `@media (max-width: 900px)` rule at `144–148` sets only the weaker `.search { width: 180px }`, which loses to the 0-2-0 co-selector at `51–54`. (Same defect class the file's own comment at `49–50` warns about.)
- Users toolbar: `users-toolbar.module.css:9–12` — `.searchForm { flex: 1; min-width: 200px }`; filters move into a `Drawer` only below 767px (`57–65`), so at 768–1023px the row stays horizontal inside a much narrower workspace.
- Users table: `users-listing.tsx:538–546` — no `scroll={{ x }}` and `pagination={false}`; `users-listing.tsx:244` — the Created column is `responsive: ["md"]`, and Ant Design evaluates breakpoints from `window` width, so at a 768px viewport the column still renders even though the workspace is ~488px wide. Role table already does this correctly with `scroll={{ x: 640 }}` (`roles-listing.tsx:63`), which is the inconsistency to close.
- Forms: `user-create-form.module.css:50–55,169–178` and `user-edit-screen.module.css:74–84,110–119` stack the two columns below 1024px, but the save bars are `display: flex` without `flex-wrap`, so a long status string plus two buttons can overflow at narrow widths. Roles' save bar wraps (`roles.module.css:44–56`).
- Dialogs are *not* the cause: Ant Design caps modal width via `max-width: calc(100vw - 16px)` below `screenSMMax` (`node_modules/antd/es/modal/style/index.js:87–97,107–109`), so the 420px `ConfirmDialog` is safe on a phone.
- Historical screenshots (`qa-corrected-768.png`, `qa-corrected-390.png`) show the expanded 224px sidebar, a clipped email column and a bottom horizontal scrollbar at 768, and a ~110px content strip at 390 with the header search cut off.

**Recommended fix**

1. Give the shell one responsive mode: below ~1024px collapse the sidebar to 72px automatically (or turn it into a `Drawer` below 768px), and reduce `.main` padding below 768px.
2. Fix the header cascade: put the width override on the same co-selector (`.search:global(.ant-input-affix-wrapper)`), allow the search to shrink, and let the bar hide the decorative bell or shorten the breadcrumb instead of clipping.
3. Add `scroll={{ x: <sum of min column widths> }}` to the users `Table`, or switch the `responsive` columns off the viewport by hiding them from the shell's own container width.
4. Allow the users save bars to wrap, mirroring the roles bar.
5. Keep the tokens: use existing spacing variables rather than new magic numbers.

**Backend dependencies:** none.

**Regression tests**

- Playwright, two viewports (768×900, 390×844) on `/admin/users` and `/admin/roles`: assert `document.documentElement.scrollWidth <= window.innerWidth`, and that the table region either fits or is a focusable scroll container.
- Assert the header search is fully visible (bounding box inside the viewport) at 390.
- A DOM test for the shell mode is possible with `matchMedia` stubs, but the CSS breakpoints themselves need a real browser; keep this in the (non-CI) manual verification pass, per `docs/verification.md:112–123`.

---

### UI-01 — Next.js CSS preload warning

| Field | Detail |
|---|---|
| Test case | UI-01 |
| Root cause | **Unconfirmed.** Historical evidence shows a Chrome dev-mode warning that a hashed stylesheet (`src_1y83xy__hrylc._.css`) was preloaded but not used on `/admin/roles`. No `useForm` warning or runtime exception appeared in the seven-screen tour. Next.js emits the preload for route CSS and injects the stylesheet through React's `precedence` resource path; in development, precedence values are per-file and change on HMR (`node_modules/next/dist/server/app-render/render-css-resource.js:17–51`), which can leave a preload unmatched. |
| Responsibility | UNCONFIRMED — most likely Next.js development tooling, not application code. |
| Severity | P3 (dev-only noise), unless it also appears in a production build, which has not been checked. |
| Confidence | Low. No application `preload`/`preinit` usage exists (`grep` over `src` returns nothing), and the project relies on declared CSS imports. |

**Evidence**

- `render-css-resource.js:24` — dev uses `precedence = 'next_' + entryCssFile.path`; production uses a single `'next'`. This is explicitly HMR-oriented ordering.
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md:453–458` — the docs separate development Fast Refresh behaviour from production, where CSS is chunked and concatenated; they also say CSS ordering can differ in development and the build is the authority.
- Historical note: `.scratch/accounts-roles-browser-qa/report.md:21`.
- No custom `<link rel="preload">`, `ReactDOM.preload`, or `next/font` misuse was found in `src`.

**Recommended action**

1. Reproduce once with `next build && next start` on `/admin/roles`; if the warning disappears, close as a development-only observation and note it in the QA record.
2. If it persists in production, capture the exact hashed filename and the requesting route before changing anything; do not "fix" it by removing CSS imports.
3. Do not add manual preload tags — that would create a second CSS pipeline for a warning that Next.js already handles.

**Backend dependencies:** none.

**Regression tests:** none appropriate at unit level. If it survives production verification, a CI assertion is possible only by scanning the built HTML for preloads that have no matching stylesheet — low value; prefer a documented manual check.

---

### INT-04 — Old access token becomes valid after account unlock

| Field | Detail |
|---|---|
| Test case | INT-04 (P1) |
| Root cause | **Backend, confirmed as behaviour; mechanism unverified.** A JWT that was rejected while the account was locked is accepted again after unlock, on the same token. That means authorization is derived from current account status rather than from token issuance/revocation state, so "reject while locked" does not invalidate the token. The frontend cannot cause or fix this. |
| Responsibility | BACKEND |
| Severity | P1 — a session that was terminated by an administrative action resumes without re-authentication. |
| Confidence | High for the observed HTTP behaviour; low for the implementation detail, because the backend source is unavailable. |

**Evidence**

- Historical browser evidence: while locked, the exact token returned `401`; after unlock, the same token returned `200` from `/auth/me`; the revoked refresh token stayed rejected and a fresh login worked (`.scratch/accounts-roles-browser-qa/report.md:20`).
- Contract statements: locking revokes refresh tokens and "the existing access token also stops working on the next request" (`docs/admin-api-contract.md:134–135`); unlock "does not restore revoked refresh tokens" (`docs/admin-api-contract.md:423`); access tokens carry no permission claims, and authorities are loaded per request (`docs/admin-api-contract.md:114–116`). Nothing in the contract says the access token is *invalidated*; only that it stops working while the account is locked.
- Frontend flow cannot extend a token's validity: `src/features/auth/session.ts:5–20` keeps the access token in memory only; `src/stores/auth-store.ts:74–113` revalidates with that token and then falls back to the HttpOnly-cookie refresh; `src/lib/api/client.ts:52–133` simply attaches headers and turns HTTP failures into `ApiError`. There is no local token minting, caching of an authorization decision, or retry that could resurrect a rejected token.
- A frontend-only mitigation (force logout on 401) would not help: reintroducing the same token after unlock is a server decision, and the browser has no way to distinguish "token invalidated" from "account temporarily locked".

**Frontend contribution:** none to this symptom. There is a *separate* frontend weakness around failed revalidation, documented in §3.2, which can leave stale identity and permissions on screen; that is a different problem and must not be sold as a fix for INT-04.

**Recommended fix (backend):** see §5. Possible designs include a token version/`tokensValidAfter` claim checked per request, a denylist keyed by `jti` populated on lock, or treating lock as an account-state gate that also invalidates previously issued tokens. The frontend needs no change unless the backend starts returning a distinct error code for revoked tokens.

**Regression tests**

- Backend integration test: issue a token, lock the account, assert 401, unlock, assert the same token is **still** 401, and assert a fresh login succeeds.
- Frontend test (defensive, valuable regardless): when `/auth/me` returns 401 during revalidation, the store must end in `anonymous` and the guard must redirect — currently not covered (§4).

---

## 2. Cross-cutting observation: the same truncation bug in name and email

`user-create-form.tsx:269` (name) and `:295` (email) use the identical native-cap pattern with validators that can never fire for overlength input (`user-create-form.ts:44–70`). The checklist did not record them, but the root cause and fix are the same, and fixing only password/address would leave two known instances behind. Treat ADD-08, ADD-13, RA-02, RA-06, user name, and user email as one defect class with one policy decision.

---

## 3. RBAC integration review

### 3.1 Inconsistency: the Users role selector swallows every failure, including 401

- `src/features/users/admin/use-admin-roles.ts:35–60` catches **all** errors and substitutes `FALLBACK_STAFF_ROLES`, with a comment that assumes the failure is a missing `role:read` 403.
- The hook does not check `role:read` before calling `listAdminRoles()` (which the contract requires, `docs/admin-api-contract.md:82`), so it issues a request that is expected to fail for some accounts on every mount.
- A 401 here neither clears the session nor redirects, unlike every other admin read (`users-listing.tsx:155–164` → `useUserApiFailure`; `roles-listing.tsx:36–38` → `useAdminApiFailure`). The user sees fallback role options in a form for an expired session and only discovers it on submit.
- Contrast with the catalog, which keeps its optional data fetch local but still degrades only that filter: `products-listing.tsx:161–186`.
- **Recommendation:** gate the request on `role:read`, and route 401 through the shared failure hook. Keep the fallback only for 403/connection/contract failures, and surface `usingFallback` as it already does.

Severity: P2 (misleading state, delayed session termination). Responsibility: FRONTEND. Confidence: High.

### 3.2 Stale identity and permissions after failed revalidation

- `src/stores/auth-store.ts:99–106` clears the token on any revalidation failure but deliberately keeps the previously resolved `user` and `status` whenever `user !== null`. That includes an authoritative HTTP rejection, not just a transport failure — the transport case is singled out at `38–41,85–91`, so the broad `catch` at `99` catches HTTP failures too.
- `src/components/layout/admin-portal-guard.tsx:40–62` runs its check once per shell mount and `64` trusts `user`; the shell lives in a persistent layout (`src/app/admin/(shell)/layout.tsx:14–19`), so client-side navigation between admin routes does not re-check. A tab left open after a lock or permission change keeps rendering the old identity and gates until an API call returns 401/403.
- Mitigations that do exist: `use-admin-api-failure.ts:14–22` clears the store and redirects on 401; `role-editor.tsx:61–74,141–147` refreshes `getMe()` after saving its own role and blocks further writes if the refresh fails. External changes to *another* role do not refresh anything.
- Contract basis for the backend being authoritative: permission changes apply on the next request with the same token (`docs/admin-api-contract.md:136–137,650–651,1030`).

Severity: P2 (stale UI, potential action on revoked authority until the first 403). Responsibility: FRONTEND (with the backend remaining the enforcement point). Confidence: Medium-High.

**Recommendation:** distinguish transport failures from HTTP rejections in `revalidate()`; on an HTTP rejection, fail closed (`user: null`, `anonymous`) so the guard redirects. Optionally revalidate on focus/visibility change for long-lived admin tabs. Do not attempt to poll permissions from every component.

### 3.3 403 handling does not refresh permissions

- `admin-api-error.ts:12–18` classifies 403 as `forbidden`; `use-admin-api-failure.ts` shows a message but leaves the cached permissions untouched. A viewer whose grant was just removed keeps seeing the button that produced the 403.
- This is consistent across users, roles, and catalog, so it is a platform-level choice rather than a users-module inconsistency. It is acceptable as long as the backend enforces; document it, or add a single `revalidate()` call on 403.

### 3.4 Gate asymmetry between Users and Roles

- Roles: the list and detail screens gate reads on `role:read` (`roles-listing.tsx:27,33–40,60`; `role-detail-screen.tsx:19,23–36,39`), and the editor disables controls without `role:update` (`role-editor.tsx:47,162,167,170–174`).
- Users listing/detail: gate on `user:read` (`users-listing.tsx:88,138–140,450–455`; `user-detail-screen.tsx:71–74,82,127–136`).
- Users edit: gates only on `user:update` (`user-edit-screen.tsx:25,31,51,58–59`) but immediately calls `getAdminUser`, which requires `user:read`. An update-without-read account therefore sees "You don't have permission to edit this account" only *after* a doomed request, instead of the same pre-emptive 403 gate the other screens use. The backend still enforces; the UX is the inconsistency.
- Direct-URL gates are otherwise sound: `/admin/users/new` renders a 403 result without `user:create` (`user-create-form.tsx:194–207`), `/admin/roles/new` likewise (`role-create-form.tsx:17–20`), and catalog create does the same (`product-create-form.tsx:131–137`).
- Sidebar visibility: `admin-sidebar.tsx:21–37` is static and never filters by permission. Per ADR `0001-admin-portal-for-all-company-accounts.md`, the portal boundary is `roleCode !== "CUSTOMER"`, and the sidebar is a map of the portal, not an authority list. So visible restricted links are **not** an authorization bypass; they lead to a screen whose own gate explains the missing grant. Record it as a deliberate decision, not a defect, if the checklist expects filtering.

### 3.5 Permission hooks are consistent

`use-user-permissions.ts:28–39`, `use-role-permissions.ts:8–12`, and `use-catalog-permissions.ts:28–39` all read `state.user?.permissions`, use exact-match helpers (`model/permissions.ts` in each feature), and document that they are hints, not enforcement. This part of the RBAC integration is coherent; the defects above are about *when* the cached snapshot is refreshed and how failures are routed, not about how permissions are checked.

---

## 4. Test coverage review

### What is covered (and passed here)

- Validator boundaries and payload normalization for both user and role forms, including the overlength *rules* (`user-create-form.test.ts:25–33`; `role-form.test.ts:12–16`).
- Permission gates: hidden add button, no-access result with zero requests, read-only editor, self-edit locks (`users-listing.test.tsx:216–239`; `role-detail-screen.test.tsx:27–43`).
- 401 redirects on list reads (`users-listing.test.tsx:253–263`).
- Partial operations: bulk-delete failure summary (`users-listing.test.tsx:338–361`), role information saved but permissions failed (`role-detail-screen.test.tsx:152–166`), own-role refresh and `role:read` removal redirect (`181–205`).
- Error parsing for 400/409 (`create-errors.test.ts`, `role-api-error.test.ts`).

### Gaps that correspond to the reported failures

| Gap | Why the current suite misses it | Suggested test |
|---|---|---|
| Paste truncation (ADD-08/13, RA-02/06, name, email) | Tests use `fireEvent.change`, which bypasses native `maxLength`; jsdom enforces no cap. The validators are tested directly, so they pass while the UI silently truncates. | Component test with an over-length change event asserting a visible error and no API call, *after* removing the native cap. Optionally a one-off Playwright paste check with `keyboard.insertText`, validation-only, no submit. |
| Delete pending behaviour (DEL-03) | No deferred-promise delete tests; no assertion about cancel/close while in flight; no duplicate-click assertion. | Deferred `deleteAdminUser`, double confirm, assert one call; assert cancel is disabled/no-op; assert state recovery on rejection. |
| Pagination history (LIST-09) | Router methods are mocked; tests assert `replace` is called but never assert `push` for pagination, and never simulate history. | Assert `push` for page/tab changes and `replace` for clear-filters; E2E `goBack`/`goForward` on a mocked route. |
| Session revalidation (INT-04 frontend side, §3.2) | `auth-store.test.ts` has one hydration test (`27–59`); no test for failed revalidation, HTTP vs transport treatment, or the guard at all (no `admin-portal-guard.test.tsx`). | Test: revalidate rejects with `ApiError(401)` while a user is cached → `user` is null and `status` is anonymous; transport failure policy asserted explicitly. Render the guard with a resolved/anonymous store and assert redirect vs children. |
| Role selector 401 (§3.1) | No test drives `useAdminRoles` through a 401. | Test that a 401 from `listAdminRoles` triggers the shared failure path (clear + redirect) rather than fallback options. |
| Responsive layout (UI-05) | No layout tests; Playwright mobile projects are commented out in `playwright.config.ts` and the only spec visits `playwright.dev` (`e2e/example.spec.ts`). | Manual/supervised Playwright viewport assertions described in UI-05; keep out of CI per `docs/verification.md:112–123`. |

### Safe testing strategy for failures and partial operations

- Keep everything hermetic: mock the feature API module or `fetch`; assert URLs and payloads, never open a socket (the existing API tests already do this, e.g. `users.api.test.ts`, `products.api.test.ts`).
- Drive partial bulk failure with a per-id `mockImplementation` that rejects one id with `ApiError(409)` and resolves the rest (the pattern already used at `users-listing.test.tsx:338–346`); this needs no shared data.
- Drive network failure with `ApiError(message, 0)` — the real `apiFetch` produces exactly that on a transport error (`client.ts:80–88`) — and assert the connection copy and the absence of a false logout.
- For pending-state assertions use a manually resolved `Promise` and `act`; never `setTimeout`.
- Do not add live E2E to CI, and do not create fixtures for last-admin/role-in-use conditions; the historical QA already recorded those as Blocked for exactly that reason (`.scratch/accounts-roles-browser-qa/report.md:29–30`).

---

## 5. Prioritized remediation plan

**P1 — silent data alteration and a security-relevant backend behaviour**

1. **ADD-08 / RA-02** — remove the native `maxLength` on the password and role-code controls, keep/reinforce the validators, and add explicit length branches so the message is unambiguous. This is a small, shared fix; do it for name/email/address/role-name/description in the same change (ADD-13, RA-06).
2. **INT-04** — send to the backend as a token-lifecycle defect. Frontend work is limited to failing closed on rejected revalidation (§3.2) and must not be presented as a fix.

**P2 — behaviour and UX**

3. **UI-05** — responsive shell mode, header cascade fix, users-table `scroll.x`, wrapping save bars. Follow the roles table's existing pattern and the design tokens.
4. **LIST-09** — decide the history policy explicitly (push for discrete navigation), implement once in a shared query helper, apply to users and products together.
5. **§3.1 / §3.2 / §3.3** — route 401 from `useAdminRoles` through the shared handler; fail closed on HTTP revalidation failures; decide whether a 403 should refresh permissions.
6. **§3.4** — align the users edit gate with the roles pattern (read gate before the request), or document the deliberate difference.

**P3 — polish**

7. **DEL-03** — expose `disabled`/`aria-disabled` on Cancel and OK while pending; keep the existing guards.
8. **UI-01** — verify once against `next build && next start`; close if dev-only.

**Order rationale:** the truncation class is one policy decision and one shared change; it is also the only defect that silently persists wrong data (a password, a permanent role code). INT-04 is next because it is a real security regression, even though the fix is not ours. UI-05 and LIST-09 are visible usability failures with contained fixes. The RBAC items are correctness-adjacent but only matter after a permission change mid-session.

---

## 6. Findings for the backend developer

1. **Token revocation on lock is not durable (INT-04).** A token issued before a lock works again after unlock. Observed: 401 while locked, 200 on the same token after unlock, revoked refresh still rejected. Decide the intended semantics:
   - Should lock permanently invalidate access tokens issued before it?
   - Should unlock require a fresh login (as refresh already does)?
   - If yes, implement a token version / `jti` denylist / `tokensValidAfter` check evaluated on every request, and return a stable error code so the UI can distinguish "revoked" from "temporarily locked".
2. **Confirm the intended client policy for overlength input.** The API rejects `password > 128`, `address > 255`, role `code` outside 2–50/pattern, `name > 255`, `description > 2000`. The frontend is changing from silent truncation to visible rejection, with no API change expected. Confirm no backend-side truncation occurs and that a 400 message names the field (it already does for users; role updates note the exact text is unverified, `docs/admin-api-contract.md:1008`).
3. **Role code immutability + soft delete.** Because a truncated code becomes permanent and unreusable, confirm that a future code change is out of scope and that the soft-delete reservation is intentional (it is documented; the frontend should surface it as it does).
4. **Permission-change timing.** The contract says changes apply on the next request (`docs/admin-api-contract.md:136–137,1030`). Confirm that `/auth/me` reflects the new set immediately after a `PUT /roles/{id}/permissions`, since the role editor relies on that to refresh the signed-in user's own permissions (`role-editor.tsx:61–74`).
5. **403 vs 401 distinctions.** Confirm that a locked/deleted principal always yields 401 (`docs/admin-api-contract.md:1010`) and that a missing permission always yields 403 with `Access denied`, so the frontend's `session-expired` vs `forbidden` split stays correct.
6. **`GET /admin/roles` access.** Confirm it requires `role:read` and that no read-only listing exists for user-form role options without that grant; the frontend will gate the request accordingly and keep the fallback for genuine 403s.

---

## 7. Remaining uncertainty

- **INT-04 mechanism** — the backend source is absent, so the cause is inferred from HTTP behaviour plus the contract, not read from `SecurityConfig` or the JWT filter. The *behaviour* is confirmed; the *implementation* is not.
- **UI-01** — not reproduced in this session, and no production build was run. The warning is plausibly a development/HMR artifact given `render-css-resource.js` and the CSS docs, but that attribution remains a hypothesis.
- **UI-05 screenshots** were captured under Chrome origin zoom 75% (recorded in the QA report); the clipping is real, but the exact CSS-pixel breakpoint at which it begins was not re-measured here.
- **ADD-08 severity** depends on whether a user pastes and submits without inspecting the field; the mechanism is certain regardless.

No fixes were implemented. Awaiting approval before touching any file.
