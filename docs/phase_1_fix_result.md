# Phase 1 fix — antd "useForm is not connected" warning on the user forms

Status: fixed and verified on branch `midu/accounts`. Nothing committed or pushed.

Symptom: opening `/admin/users/[userId]/edit` logged

```
Warning: Instance created by `useForm` is not connected to any Form element. Forget to pass `form` prop?
```

---

## 1. Root cause

`@rc-component/form`'s `FormStore` carries a development-only guard. Any form-store call that
touches values — `getFieldValue`, `getFieldsValue`, `setFieldValue`, `setFieldsValue`, `setFields`,
`resetFields`, `validateFields`, `submit` — goes through `warningUnhooked()`. That schedules a
macrotask which prints the warning if the store was never claimed by a mounted `<Form>`
(`formHooked` is only set when a `<Form>` calls `getInternalHooks`).

Two places called a store method before any `<Form>` existed:

### `user-edit-screen.tsx`

`<Form form={form}>` renders only inside the `ready` branch. The load effect called
`form.setFieldsValue(initial)` in the promise callback, before the `setState` that renders that
branch — and in some builds, it also called `setDraft` right after. The timer for the check was
queued before React's scheduler task, so it could fire while the Form still was not mounted.

Seeding this way had a second defect: on a Form remount (retry after an error), rc-field-form
merges `initialValues` **under** the existing store (`merge(initialValues, this.store)`), so stale
values from the previous attempt could survive the reload.

### `user-create-form.tsx`

`Form.useForm()` and the role-default effect ran unconditionally, including when `!mayCreate`
returned the 403 branch — which renders no `<Form>` at all. That effect called
`form.getFieldValue("role")` on an instance that could never mount, so this path warned every time.

### Why the tests did not catch it first

The edit path is timing-dependent: React Testing Library flushes renders synchronously inside
`act`, so the Form was mounted before the timer fired and the warning never appeared in jsdom. The
create 403 path is deterministic, which is why it was used to reproduce the warning before fixing it.

---

## 2. Reproduction (red)

A regression test was added to `user-create-form.test.tsx` first and failed against the old code
with exactly:

```
Warning: Instance created by `useForm` is not connected to any Form element. Forget to pass `form` prop?
```

---

## 3. Fix

### Edit screen (`src/features/users/admin/components/user-edit-screen.tsx`)

- The load effect now only sets `{ status: "ready", user }`. No form API is called before the
  Form exists.
- The Form seeds itself on mount: `initialValues={{ role: user.roleCode, status: user.status }}`,
  declared inside the ready branch where the account is loaded.
- `clearOnDestroy` discards the store when the Form unmounts for a reload/retry, so a retry seeds
  from fresh data instead of merging over stale values. A save does not unmount the Form, so a
  partially failed update still keeps the field the user retried.
- The mirrored `draft` state is gone; one `Form.useForm()` still backs the one `<Form>` that
  renders it.

### Create screen (`src/features/users/admin/components/user-create-form.tsx`)

- The role-default effect bails on `!mayCreate` as well as `rolesLoading`, so it never touches an
  instance whose Form is not rendered. (The guard is deliberate even though `useWatch` now also
  marks the store as hooked.)

### `Form.useWatch` re-test

`Form.useWatch` **does** work in this build. Both `onValuesChange` workarounds were removed:

- Edit: `Form.useWatch([], form)` drives the "Unsaved changes" indicator and the role/status
  helper copy, so what the footer reports matches what Save would send.
- Create: `Form.useWatch("password", form)` drives the password strength meter.

The earlier "this antd build does not re-render its subscriber" diagnosis was wrong. The real
defect was the unconnected form instance in the edit screen; `product-edit-form.tsx` has always
relied on the same hook. The stale comments were replaced with the actual reasons, including why
the create effect is guarded.

---

## 4. Tests

Added:

- `user-create-form.test.tsx` — "never touches the form instance when the form is not rendered":
  mounts the 403 branch, waits a macrotask, asserts no `not connected to any Form element` warning.
- `user-edit-screen.test.tsx` — "seeds the form without touching it before it is mounted": asserts
  no warning, the role select shows the saved role (`Employee`), and Save starts disabled.

Updated:

- The password meter test and the status/role tests now wait one macrotask (`settle()`) after
  typing or clicking, because `Form.useWatch` publishes through a `MessageChannel` task. The
  assertions themselves are unchanged.

`docs/phase_1_result.md` was corrected: it previously recorded the incorrect `useWatch` claim, and
its test count now reads 273.

---

## 5. Verification

| Check | Result |
|---|---|
| Regression test, old code | Failed with the exact warning string (red). |
| Regression tests, new code | Pass. |
| Meter / dirty indicator | Password reaches "Strong"; a status change flips the footer to "Unsaved changes"; save and partial-failure tests pass. |
| `npm run check` | **Exit 0** — eslint, `lint:antd` (232 files), `tsc --noEmit`, CSS-module check, encoding check (318 files), **43 test files / 273 tests passed**. |
| `npm run build` | **Exit 0**. |

### Browser check not performed

The reported warning is only visible in a browser, and it was not re-checked there:

- `http://localhost:8080` was not running (probe returned `000`), so `/admin/users/[userId]/edit`
  can only render its error state without a loaded account.
- No Playwright browser binary is installed (`%LOCALAPPDATA%\ms-playwright` is empty).
- Starting the Spring Boot backend would apply Flyway migrations to the shared hosted database,
  which `docs/verification.md` calls a schema-mutating action.

With the backend running, the remaining check is: open Edit and Add, navigate in and reload, and
confirm the console is clean while the meter and the "Unsaved changes" indicator still update live.

---

## 6. Follow-up fix — tolerate null or empty user names

### Cause

A missing current-role profile can produce `name: null`. `UserSummarySchema` required a string,
so that one row rejected the whole list with "response did not match the expected contract".
The initials helper also called `name.trim()` directly, which would throw on null.

### Changes

- `src/features/users/admin/schema/user.schema.ts`: `name` is now `string | null`.
  `UserDetailSchema` extends the summary, and create/status/role responses already share the
  detail response schema, so all five response paths accept nullable names. `phone`, `address`,
  and `lastLogin` remain nullable. Create input validation still requires a name.
- `src/features/users/admin/model/user-format.ts`: added `displayName(user)` — trimmed non-empty
  name, otherwise the email local part, otherwise the email itself. Raw response names are not
  rewritten, and sorting/searching remain server-side.
- All user identity displays use the helper: table rows and accessible action labels, detail
  header/profile, edit subtitle/profile, delete dialog, create/delete success toasts, and bulk
  lock/delete failure summaries.
- The initials avatar accepts null names, derives its text through `displayName`, preserves the
  existing email-initial fallback, and renders `?` if both identity sources are empty.
- Null phones consistently render `—` in the list, detail, and edit screens. Address and
  last-sign-in placeholders are unchanged.

### Regression coverage and verification

Tests were written and observed failing before implementation: the schema rejected null,
the avatar threw on `null.trim()`, and empty names produced blank identity text and summaries.
Added fixtures for both `name: null` and `name: ""`, with coverage for summary/page/detail
schemas, create/status/role response parsing, display-name fallback order, avatar initials,
list/action labels, detail/edit identity, create/delete toasts, and bulk failure labels.

| Check | Result |
|---|---|
| Users feature tests | Exit 0 — **17 files / 139 tests passed**. |
| `npm run check` | Exit 0 — lint, antd lint, typecheck, CSS modules, encoding, and **45 files / 305 tests passed**. |
| `npm run build` | Exit 0 — production compilation and route generation succeeded. |

The existing jsdom `getComputedStyle` warnings still appear; they do not fail the tests.
No browser verification was performed for this follow-up. No backend, sort/search, dependency,
or form-lifecycle changes were made. Nothing was committed or pushed.

---

## 7. Follow-up fix — blank Role and incorrect Status on Edit user

### Confirmed cause

The edit Form's `clearOnDestroy` cleanup cleared its value store during React Strict Mode's
development effect replay. The Form's mount-guarded `initialValues` seed was not replayed, leaving
Role blank and a locked account's Status unselected. The account data and role catalog were loaded.
`Form.Item` names and `initialValues` keys already matched (`role` and `status`), and the customer
role already had a display option. Those were not the cause of the blank control.

Existing tests did not use Strict Mode. New tests first reproduced eight empty-role cases
(employee/admin/customer/missing custom role, with and without role-list failure), plus lost Status.

### Fix

- Split loading/gating into `user-edit-screen.tsx` and the connected, component-owned form into
  `user-edit-form.tsx`. The child mounts only with loaded data and gets a fresh store on an account
  change or reload. Removed `clearOnDestroy`; no pre-mount form writes or effect-based reseeding.
- Both `initialValues` keys still match their Form fields exactly. `Form.useWatch` continues to
  drive the dirty indicator; sequential saves and partial-failure behavior remain intact.
- `editUserRoleOptions` always represents the current account role with its own `roleName`, even
  when the catalog label differs. Customer and missing/deleted custom roles are displayable but
  disabled as assignment choices. Matching is case-insensitive without rewriting the stored value.
- Customer, self-edit, and role-list-fallback locks are preserved. Both ACTIVE and LOCKED Status
  values survive Strict Mode replay; self-edit Status stays disabled and visible.
- Detail displays `roleName` directly, so it had no option-matching defect; all four role variants
  are regression-tested without changing that screen.
- The list filter already displayed an unavailable role's code, but the dropdown lacked a matching
  option. `userRoleFilterOptions` now retains that selected option without changing its query or
  inventing a role name unavailable from the catalog.

### Verification

| Check | Result |
|---|---|
| Failing regressions before implementation | Blank Strict Mode role/status, stale form on account navigation, catalog label overriding account label, missing filter dropdown option. |
| `npm run check` | Exit 0 — **59 test files / 395 tests passed**, plus lint, antd lint, typecheck, CSS-module and encoding checks. |
| `npm run build` | Exit 0. |
| Edge browser against Next dev with mocked API | **11/11 flows passed**: role/fallback matrix, direct load/reload/navigation, both Status values, self locks, live edits and sequential save, missing-role filter. |

Browser verification produced no unexpected console issues or disconnected-form warnings. Mocked
role-list 403 failures were expected in fallback scenarios. No live backend requests, dependency
changes, commits, or pushes were made. This section supersedes the earlier `clearOnDestroy`
recommendation in section 3.
