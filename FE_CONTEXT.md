# FE_CONTEXT — Frontend onboarding brief

Read-only survey of this repository, written for an AI assistant about to build an **Admin User Management** UI
(list/detail/create/lock-unlock/change-role/soft-delete users, later roles & permissions).

- **Survey date:** 2026-11-10
- **Method:** read-only inspection of the working tree. No files were modified and no install/build/test command was run.
- **Limits of this survey:** `git` is not on `PATH` (`git : The term 'git' is not recognized…`), so branch and working-tree
  state could not be read. The backend source path named in `AGENTS.md` (`D:\VSCode\UniProjects\DACN`) does **not exist**
  on this machine (`Test-Path` → `False`), so backend claims below come from `docs/api-contract.md` and frontend code only.
- **Secrets:** no `.env` value is reproduced. Only variable **names** appear (§8).

---

## 1. PROJECT OVERVIEW

### 1.1 Framework, language, package manager, Node

| Item | Value | Evidence |
|---|---|---|
| Framework | **Next.js 16.4.2** (`^16.4.2`) | `package.json:21` |
| Router | **App Router only** — `src/app/**`, no `pages/` directory | `src/app/`, `globals` layout at `src/app/layout.tsx` |
| React | **19.2.8** (pinned, no caret) | `package.json:22-23` |
| Language | **TypeScript**, `strict: true`, `noEmit`, `moduleResolution: "bundler"` | `tsconfig.json:11-15` |
| Package manager | **npm** — `package-lock.json` present, no `pnpm-lock.yaml`/`yarn.lock` | repo root listing |
| Node version | **NOT PINNED** — no `engines` in `package.json`, no `.nvmrc`, no `.node-version` | `package.json`, root listing |
| Prettier | **NOT FOUND** — no `.prettierrc*`, no `prettier` dependency. Formatting is by convention: **tabs**, double quotes, semicolons | `package.json`, `eslint.config.mjs` |

Note: `AGENTS.md` says this Next.js version differs from training data and that `node_modules/next/dist/docs/` must be read
before writing code. That directory is the version-accurate reference for any Next.js API used here.

### 1.2 Dependencies by purpose

Everything below is the complete set — there is no hidden UI/form/data layer.

| Purpose | Package | Version | Notes |
|---|---|---|---|
| UI library | `antd` | `^6.6.5` | The only component library. **v6**, with renames (`Alert.title`, `Listy`, `Select.showSearch`) |
| UI icons | `@ant-design/icons` | `^6.3.4` | Plus static SVG assets in `public/images/admin/**` |
| SSR style extraction | `@ant-design/nextjs-registry` | `^1.3.0` | `<AntdRegistry>` in `src/app/layout.tsx` |
| Framework | `next` | `^16.4.2` | |
| React | `react`, `react-dom` | `19.2.8` | |
| Validation | `zod` | `^4.6.5` | **API response parsing only** — not used for form validation (§6.4) |
| Client state | `zustand` | `^5.0.15` | One store: `src/stores/auth-store.ts` |
| Lint | `eslint` + `eslint-config-next` | `^10.13.0` / `^16.4.2` | flat config |
| antd lint | `@ant-design/cli` | `^6.6.8` | offline `antd info`/`token`/`lint` + `npm run lint:antd` |
| Unit tests | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom` | `^5.0.5`, `^30.1.3`, `^16.3.3`, `^10.4.2` | |
| E2E | `@playwright/test` | `^1.64.1` | configured, unused (§9) |
| Types | `@types/node`, `@types/react`, `@types/react-dom`, `typescript` | `^24`, `^19`, `^19`, `^5` | |

**Absent (verified by reading `package.json` in full):** axios, ky, SWR, TanStack Query, react-hook-form, Formik, Yup,
Tailwind CSS, styled-components, Emotion, shadcn/ui, Radix, MUI, next-intl / i18next, dayjs, lodash, MSW, json-server.

### 1.3 Scripts

```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "eslint",
"typecheck": "next typegen && tsc --noEmit --incremental false",
"check:css": "node scripts/check-css-modules.mjs",
"check:encoding": "node scripts/check-encoding.mjs",
"lint:antd": "node scripts/lint-antd.mjs",
"test": "vitest run",
"check": "npm run lint && npm run lint:antd && npm run typecheck && npm run check:css && npm run check:encoding && npm run test"
```

`src/package.json:5-16`. `npm run check` is the gate; `.githooks/pre-commit` runs the cheap subset
(`AGENTS.md` §2). Extra checks exist because both have caught real breakage: a `styles.x` with no matching CSS class,
and a BOM / double-encoded file (`scripts/check-css-modules.mjs`, `scripts/check-encoding.mjs`).

### 1.4 Folder structure

```text
src/
├─ app/
│  ├─ (auth)/login/, (auth)/register/          # storefront sign-in / sign-up
│  ├─ (storefront)/                             # customer shell: header + footer
│  │  ├─ page.tsx, about/, faq/
│  │  ├─ products/, products/[slug]/
│  │  ├─ cart/, checkout/
│  │  └─ account/, account/orders/, account/orders/[orderId]/
│  ├─ admin/
│  │  ├─ page.tsx                               # redirect → /admin/dashboard
│  │  ├─ login/page.tsx                         # company sign-in (outside the shell group)
│  │  └─ (shell)/                               # guard + sidebar + header
│  │     ├─ dashboard/page.tsx
│  │     └─ products/, products/new/, products/[slug]/edit/
│  ├─ api/health/route.ts                       # frontend-owned health endpoint
│  ├─ layout.tsx, providers.tsx, globals.css
│  └─ error.tsx, global-error.tsx, loading.tsx, not-found.tsx
├─ components/
│  ├─ auth/       # TextField, PasswordField, PrimaryButton, AuthLayout, GoogleAuthOption
│  ├─ dialogs/    # ConfirmDialog, FeedbackDialog, store-dialogs presets
│  ├─ feedback/   # EmptyState, ErrorState, LoadingState
│  ├─ layout/     # SiteHeader/Footer, AdminLayout/Header/Sidebar/PortalGuard
│  └─ ui/         # SectionHeading, MediaPlaceholder, RevealGroup
├─ features/
│  ├─ auth/       # session, api, schema, model, storefront/, admin/
│  ├─ cart/       # api, schema, storefront/{hooks,components}
│  ├─ orders/     # api, schema, types, storefront/{model,components}
│  └─ products/   # api, schema, types, model, storefront/, admin/{api,model,components}
├─ hooks/         # use-mobile.ts (one hook)
├─ lib/
│  ├─ api/        # client.ts, parse.ts, schema/{api-response,page-response,enums}
│  ├─ constants/  # labels.ts (status label maps), index.ts
│  ├─ utils/      # initials.ts
│  ├─ design-tokens.ts
│  └─ env.ts
├─ stores/        # auth-store.ts (+ test)
├─ styles/        # EMPTY — only .gitkeep
└─ types/         # index.ts — enum-derived status unions
```

One line each:

- `src/app/` — routes, layouts, boundaries, and the one frontend-owned route handler.
- `src/components/` — domain-independent UI (`ui/`), shared feedback, shared dialogs, app chrome (`layout/`), auth widgets.
- `src/features/<name>/` — one bounded context per feature: `api/`, `schema/` (Zod), `model/` (pure logic), `types/`,
  and `components/` (sometimes split `storefront/` vs `admin/`).
- `src/hooks/` — cross-feature React hooks.
- `src/lib/api/` — the HTTP client, response parsing, and shared envelope/page schemas.
- `src/lib/constants/` — display label maps keyed by status enums.
- `src/lib/utils/` — tiny pure helpers.
- `src/stores/` — Zustand stores.
- `src/styles/` — **empty placeholder**; global CSS actually lives at `src/app/globals.css`.
- `src/types/` — shared, cross-feature status unions derived from Zod enums.

### 1.5 Path alias, lint, and style rules that affect code

`tsconfig.json:25-29`:

```json
"paths": { "@/*": ["./src/*"] }
```

`eslint.config.mjs:5-26` — flat config, `nextVitals` + `nextTs`, with ignores for `.next`, `.scratch`,
`.playwright-cli`, test output. No custom rules, no rule overrides. `AGENTS.md` §8 forbids disabling rules to silence
errors.

Conventions that matter when adding files (all observed in existing code, and codified in `CODING_STANDARDS.md`):

- Tabs for indentation; double quotes; named exports (`export function X`) — no default exports except route files.
- In `"use client"` components, interactive elements are **antd primitives**; raw HTML only for design-supplied content
  and static layout (`CODING_STANDARDS.md` § Antd in client components).
- CSS Modules colocated as `<component>.module.css`; every `styles.x` must exist in that file (`npm run check:css`).
- Files must be UTF-8 **without BOM** and without the PowerShell round-trip signature (`npm run check:encoding`).

---

## 2. UI & STYLING SYSTEM

### 2.1 Styling approach

Three layers, no Tailwind:

1. **`src/app/globals.css`** — resets, `.page-container`, a couple of utilities (`.eyebrow`), reduced-motion query.
2. **`src/lib/design-tokens.ts`** — the single source of colours, type scale, spacing, radii, layout; emits
   `--color-*`, `--space-*`, `--radius-*`, `--font-*` CSS custom properties injected on `<html>` in
   `src/app/layout.tsx:45`.
3. **CSS Modules** per component, consuming those variables, plus **antd theme tokens** via `ConfigProvider`.

Key token groups (`src/lib/design-tokens.ts`):

```ts
brandTeal: "#1BC5BD",  brandDeepTeal: "#115E59",  brandDarkTeal: "#0E443E",
surfacePage: "#F2F7F5", surfaceWhite: "#FFFFFF",
textHeading: "#0F172A", textBody: "#475569", textMuted: "#64748B",
borderLight: "#E2E8F0", borderInput: "#CBD5E1",
danger: "#B42318",
admin: {
  sidebarSurface: "#0C3532", sidebarActiveSurface: "#1A5650",
  panelBorder: "#DFE8E4", panelTextMuted: "#687D7B", panelTextStrong: "#142D2D",
  avatarSurface: "#E9F5F1", panelSurfaceSubtle: "#F6F9F7",
  focusRing: "#2A9D8F",
  statusWarningSurface: "#FCF3E3", statusWarningText: "#97661C",
  statusDangerSurface: "#FBEFEE", statusDangerText: "#BC5A53",
}
```

Typography: `Plus Jakarta Sans` (`--font-plus-jakarta-sans`, wired through `next/font/google` in `src/app/layout.tsx:8-13`),
plus `Fraunces` and `Manrope` loaded but only used decoratively. Breakpoints are plain media queries —
`768px` is the mobile boundary (`src/hooks/use-mobile.ts:6`, `src/app/globals.css:149`), `1024px` splits the editor grid
(`docs/design.md` § Admin catalog).

### 2.2 Component library and the existing reusable components

**Ant Design v6** only. Two themes: the global storefront theme in `src/app/providers.tsx`, and scoped admin themes
(`AdminCatalogTheme`, `loginTheme`). There is no `Button.tsx`/`Input.tsx` wrapper layer — antd *is* the primitive layer.

Reusable, non-antd components that exist (props signature as declared):

| Component | File | Props |
|---|---|---|
| `ConfirmDialog` | `src/components/dialogs/confirm-dialog.tsx` | `{ open, title, description?, confirmText?, cancelText?, confirmLoading?, onConfirm, onCancel }` |
| `FeedbackDialog` | `src/components/dialogs/feedback-dialog.tsx` | `{ open, variant: "success"\|"error"\|"warning"\|"info", title, description?, icon?, actions?: {label,onClick,variant?,disabled?}[], redirectUrl?, redirectText?, onClose, closeOnMaskClick?, closeOnEscape?, showCloseButton?, showEyebrow? }` |
| `PaymentSuccessDialog` / `PaymentFailedDialog` / `LogoutDialog` / `LoginRequiredDialog` / `RemoveItemDialog` / `NetworkErrorDialog` | `src/components/dialogs/store-dialogs.tsx` | `{ open, onClose, … }` presets over `FeedbackDialog` |
| `EmptyState` | `src/components/feedback/empty-state.tsx` | `{ title?, description?, action?, className? }` |
| `ErrorState` | `src/components/feedback/error-state.tsx` | `{ title?, description?, retryLabel?, onRetry?, action?, className? }` |
| `LoadingState` | `src/components/feedback/loading-state.tsx` | `{ rows?, title?, label?, className? }` |
| `MediaPlaceholder` | `src/components/ui/media-placeholder.tsx` | `{ icon?, text?, className?, label? }` (no network request) |
| `SectionHeading` | `src/components/ui/section-heading.tsx` | `{ title, eyebrow?, description?, level?: 1\|2\|3, align?: "left"\|"center", className?, id? }` |
| `RevealGroup` | `src/components/ui/reveal.tsx` | `{ children, className?, revealedClassName }` (IntersectionObserver) |
| `TextField` | `src/components/auth/text-field.tsx` | `InputHTMLAttributes<HTMLInputElement> & { id, label, error? }` |
| `PasswordField` | `src/components/auth/password-field.tsx` | `{ id, label, name, placeholder?, autoComplete, required?, minLength?, error? }` |
| `PrimaryButton`, `Divider` | `src/components/auth/auth-controls.tsx` | `ButtonHTMLAttributes<HTMLButtonElement>` / none |
| `AuthLayout` | `src/components/auth/auth-layout.tsx` | `{ children, eyebrow, headline, description }` |
| `GoogleAuthOption` | `src/components/auth/google-auth-option.tsx` | `{ text: "signin_with"\|"signup_with", onError, disabled? }` |
| `AdminLayout` | `src/components/layout/admin-layout.tsx` | `{ children }` |
| `AdminHeader` | `src/components/layout/admin-header.tsx` | `{ currentPage: string, identity: { name, roleName } }` |
| `AdminSidebar` | `src/components/layout/admin-sidebar.tsx` | `{ collapsed, onToggleCollapse }` |
| `AdminPortalGuard` | `src/components/layout/admin-portal-guard.tsx` | `{ children }` |
| `StatusPill` | `src/features/products/admin/components/status-pill.tsx` | `{ status: ProductStatus }` — **product-only**, not generic |
| `CatalogToolbar` | `src/features/products/admin/components/catalog-toolbar.tsx` | `{ query, onChange, categories, categoriesLoading, onKeywordSubmit }` |
| `CatalogEmptyState` / `CatalogErrorState` | `src/features/products/admin/components/catalog-states.tsx` | `{ onClearFilters, hasFilters }` / `{ onRetry, message }` |
| `CatalogListSkeleton` | `src/features/products/admin/components/catalog-skeleton.tsx` | — |
| `AdminCatalogTheme` | `src/features/products/admin/components/admin-catalog-theme.tsx` | `{ children }` — scoped `ConfigProvider` |

There is **no** project-level `Table`, `Pagination`, `Badge`, `Select`, `Toast`, `Skeleton`, or `Modal` wrapper —
features use antd's `Table`, `Pagination`, `Tag`, `Select`, `App.useApp().message`, `Skeleton`, `Modal` directly.

### 2.3 Design conventions

- **Spacing scale** is sparse on purpose: `spacing = {3:12, 4:16, 6:24, 8:32, 10:40, 16:64}` — other values are written
  in CSS modules when the design needs them.
- **Status colours** (admin catalog, measured — `docs/design.md` § Admin catalog):

  | Status | Background | Text |
  |---|---|---|
  | Active | `#E9F5F1` (`admin.avatarSurface`) | `#115E59` (`brandDeepTeal`) |
  | Draft / warning | `#FCF3E3` | `#97661C` |
  | Archived / Deleted | `#FBEFEE` | `#BC5A53` |

  Implemented as a `Tag` with a scoped CSS module and a `data-status` attribute (`status-pill.tsx:26-39`). The label is
  always rendered — status is never colour-only.
- **Admin control metrics:** `controlHeight 38`, `borderRadius 6`, `fontSize 13`, primary `#115E59`, focus ring
  `#2A9D8F` (`admin-catalog-theme.tsx:27-97`). The storefront theme is deliberately different: 44px controls, pill
  buttons, `#1BC5BD` primary (`providers.tsx:13-66`).
- **Dark mode:** **NOT FOUND.** No `prefers-color-scheme`, no theme switch, no `theme.darkAlgorithm` — only
  `prefers-reduced-motion` (`src/app/globals.css:170`).
- **Icons:** `@ant-design/icons` for UI affordances (`EditOutlined`, `SearchOutlined`, `FilterOutlined`,
  `LogoutOutlined`, `ArrowLeftOutlined`), plus hand-picked SVGs under `public/images/admin/{nav,header}` rendered with
  `next/image` + `unoptimized`.

### 2.4 Language and i18n

- UI copy is **English** throughout (`"Products & Variants"`, `"Add product"`, `"We couldn't load your products"`).
- `<html lang="en">` (`src/app/layout.tsx:43`).
- **i18n: NOT FOUND.** No `next-intl`, `i18next`, `[locale]` segment, message catalogue, or `vi`/`en` dictionary.
  Vietnamese appears only in the developer-facing `FE_STATUS.md` (a survey document, not app copy).
- Dates/prices are formatted with hand-written helpers: `formatVndPrice`, `formatDate` in
  `src/features/products/storefront/model/product-format.ts` (locale-stable, not `Intl` locale-dependent).

---

## 3. ROUTING & LAYOUTS

### 3.1 Every route

| URL | File | State |
|---|---|---|
| `/` | `src/app/(storefront)/page.tsx` | static marketing UI |
| `/about` | `src/app/(storefront)/about/page.tsx` | static |
| `/faq` | `src/app/(storefront)/faq/page.tsx` | static |
| `/products` | `src/app/(storefront)/products/page.tsx` | **server component**, real API, URL-driven filters |
| `/products/[slug]` | `src/app/(storefront)/products/[slug]/page.tsx` | **server component**, real API |
| `/cart` | `src/app/(storefront)/cart/page.tsx` | real API |
| `/checkout` | `src/app/(storefront)/checkout/page.tsx` | real API |
| `/account` | `src/app/(storefront)/account/page.tsx` | real API (profile, password) |
| `/account/orders` | `src/app/(storefront)/account/orders/page.tsx` | real API |
| `/account/orders/[orderId]` | `src/app/(storefront)/account/orders/[orderId]/page.tsx` | real API |
| `/login` | `src/app/(auth)/login/page.tsx` | real API |
| `/register` | `src/app/(auth)/register/page.tsx` | real API |
| `/admin` | `src/app/admin/page.tsx` | `redirect("/admin/dashboard")` |
| `/admin/login` | `src/app/admin/login/page.tsx` | real API |
| `/admin/dashboard` | `src/app/admin/(shell)/dashboard/page.tsx` | **stub** (placeholder copy) |
| `/admin/products` | `src/app/admin/(shell)/products/page.tsx` | **done** (listing) |
| `/admin/products/new` | `src/app/admin/(shell)/products/new/page.tsx` | **done** (create) |
| `/admin/products/[slug]/edit` | `src/app/admin/(shell)/products/[slug]/edit/page.tsx` | **done** (edit) |
| `/api/health` | `src/app/api/health/route.ts` | route handler, `{status:"ok",service:"fe-dacn-frontend"}` |

**There is no `/admin/users`, `/admin/roles`, `/admin/staff`, or `/admin/customers` route.** NOT FOUND.

Boundaries (not URLs): `src/app/loading.tsx`, `error.tsx`, `global-error.tsx`, `not-found.tsx`;
`src/app/(storefront)/products/{loading,error}.tsx`; `src/app/(storefront)/products/[slug]/{loading,error,not-found}.tsx`.

### 3.2 The admin shell you can reuse

`src/app/admin/(shell)/layout.tsx` (full):

```tsx
import type { ReactNode } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { AdminPortalGuard } from "@/components/layout/admin-portal-guard";

export default function AdminShellLayout({ children }: AdminShellLayoutProps) {
	return (
		<AdminPortalGuard>
			<AdminLayout>{children}</AdminLayout>
		</AdminPortalGuard>
	);
}
```

`AdminLayout` is the page shell — sidebar + header + `<main>` (`src/components/layout/admin-layout.tsx:39-65`). Two
things must be extended when a new admin section is added:

**(a) Breadcrumb titles** — an explicit list, not derived from the URL (`admin-layout.tsx:19-30`):

```tsx
const PAGE_TITLES: { href: string; title: string }[] = [
	{ href: "/admin/dashboard", title: "Dashboard" },
	{ href: "/admin/products", title: "Products & Variants" },
];

function currentPageTitle(pathname: string): string {
	const match = PAGE_TITLES.find(
		(entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`),
	);
	return match?.title ?? "Dashboard";
}
```

**(b) Sidebar menu config** — static data, `href` present only for items that route; items without `href` render as
inert `<span aria-disabled="true">` (`admin-sidebar.tsx:22-42`, `:86-107`):

```tsx
const navItems: NavItem[] = [
	{ label: "Dashboard", icon: "/images/admin/nav/layout-dashboard.svg", href: "/admin/dashboard" },
	{ label: "Orders", icon: "/images/admin/nav/shopping-bag.svg" },
	{ label: "Products & Variants", icon: "/images/admin/nav/fish.svg", href: "/admin/products" },
	{ label: "Categories", icon: "/images/admin/nav/layers.svg" },
	{ label: "Inventory", icon: "/images/admin/nav/package.svg" },
	{ label: "Customers", icon: "/images/admin/nav/users.svg" },
	{ label: "Reviews", icon: "/images/admin/nav/message-square.svg" },
	{ label: "Promotions", icon: "/images/admin/nav/tag.svg" },
	{ label: "Analytics", icon: "/images/admin/nav/chart-no-axes-combined.svg" },
	{ label: "Staff & Permissions", icon: "/images/admin/nav/shield-check.svg" },
	{ label: "Settings", icon: "/images/admin/nav/settings.svg" },
];
```

**Menu visibility is not permission-aware.** Every item renders for every company account; the only difference is
`href` presence. `docs/adr/0001-admin-portal-for-all-company-accounts.md` records this as a deliberate deferral:
*"Sidebar navigation is role-agnostic for now; role-based visibility returns as a real decision when pages behind those
items exist."*

`AdminHeader` gives you breadcrumb + search box + account dropdown (`admin-header.tsx:64-146`). The search `Input` has
no handler and the notification bell is a static `<Image>` with the comment *"Presentational until notifications
exist"* (`admin-header.tsx:97`).

### 3.3 Route protection (there is no middleware)

`glob` for `**/middleware.{ts,js}` → **No files found.** Protection is a **client-side guard** inside the admin shell.

`src/components/layout/admin-portal-guard.tsx` (the operative part):

```tsx
const ADMIN_LOGIN_PATH = "/admin/login";
const SESSION_CHECK_TIMEOUT_MS = 10_000;

export function AdminPortalGuard({ children }: AdminPortalGuardProps) {
	const router = useRouter();
	const user = useAuthStore((state) => state.user);
	const revalidate = useAuthStore((state) => state.revalidate);
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		let active = true;
		const timeout = setTimeout(() => { if (active) setChecking(false); }, SESSION_CHECK_TIMEOUT_MS);
		void revalidate().finally(() => {
			if (!active) return;
			clearTimeout(timeout);
			setChecking(false);
		});
		return () => { active = false; clearTimeout(timeout); };
	}, [revalidate]);

	const allowed = !checking && isCompanyAccount(user);

	useEffect(() => {
		if (checking || allowed) return;
		router.replace(ADMIN_LOGIN_PATH);
	}, [checking, allowed, router]);

	if (!allowed) return <main className={styles.gate} aria-busy="true" aria-label="Checking your session"><Spin size="large" /></main>;
	return <>{children}</>;
}
```

Behaviour today:

- **Unauthenticated / expired:** `revalidate()` fails → `status: "anonymous"` → `router.replace("/admin/login")`.
- **Customer account:** `isCompanyAccount()` returns false → same redirect. No message is shown on the shell route; the
  *login page* is where "company accounts only" is explained.
- **Every mount re-asks the server** (`auth/me`), so a tab left open after a role change/revocation is re-checked on
  navigation. There is no timer/polling, so a session revoked *while a page stays open* is not noticed until the next
  mount or the next failing request.
- The guard is a **floor, not a privilege list** — any non-CUSTOMER role gets in (ADR-0001).

---

## 4. API LAYER

### 4.1 How HTTP happens

Native `fetch` wrapped once. **No axios, no React Query, no SWR, no server actions.** Two consumption styles:

- **Client components** call feature API modules in `useEffect` and hold `useState` (admin listing, orders, cart).
- **Server components** call the same modules directly (`src/app/(storefront)/products/page.tsx:77-91`).

`src/lib/api/client.ts` in full:

```ts
import { getPublicEnv } from "@/lib/env";

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly payload?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}
}

function getApiUrl(path: string): URL {
	const normalizedPath = path.replace(/^\/+/, "");
	if (!normalizedPath || /^[a-z][a-z\d+.-]*:/i.test(normalizedPath) || normalizedPath.startsWith("//")) {
		throw new Error("API paths must be relative paths such as 'products' or 'products/123'.");
	}
	const baseUrl = getPublicEnv().NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "");
	return new URL(`${normalizedPath}`, `${baseUrl}/`);
}

function getErrorMessage(payload: unknown, status: number): string {
	if (typeof payload === "object" && payload !== null) {
		const body = payload as Record<string, unknown>;
		for (const key of ["message", "detail", "title"]) {
			if (typeof body[key] === "string" && body[key].trim()) return body[key];
		}
	}
	return `API request failed with HTTP status ${status}.`;
}
```

```ts
export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
	const url = getApiUrl(path);
	const { next, ...rest } = init;
	const headers = new Headers(rest.headers);

	if (!headers.has("Accept")) headers.set("Accept", "application/json");

	const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;
	if (rest.body != null && !isFormData && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	let response: Response;
	try {
		response = await fetch(url, {
			...rest,
			...(next ? { next } : {}),
			...(next || rest.cache ? {} : { cache: "no-store" }),
			headers,
		});
	} catch (error) {
		throw new ApiError(
			error instanceof Error ? `Could not reach the API: ${error.message}` : "Could not reach the API.",
			0,
			error,
		);
	}

	if (response.status === 204) { /* …returns undefined, or throws on !ok… */ }

	const responseText = await response.text();
	let payload: unknown;
	if (responseText) { try { payload = JSON.parse(responseText); } catch { payload = responseText; } }

	if (!response.ok) throw new ApiError(getErrorMessage(payload, response.status), response.status, payload);
	if (!responseText) return undefined as T;
	if (typeof payload === "string") {
		throw new ApiError("The API returned a non-JSON response where JSON was expected.", response.status, payload);
	}
	return payload as T;
}
```

Facts that matter for a new feature:

- `apiFetch` **does not unwrap the envelope** and **does not validate** — each module does both.
- **No timeout**, **no retry**, **no interceptor**, **no 401 refresh** (see §5.2).
- **No auth headers are added automatically.** Callers pass `headers: getAuthHeaders()` explicitly.
- Default cache is `no-store` unless `next: { revalidate }` is supplied (storefront reads only).
- `status: 0` on `ApiError` means **transport failure** — code relies on that distinction everywhere.

### 4.2 Base URL and `/api/v1`

- Variable name: **`NEXT_PUBLIC_API_BASE_URL`**, validated as an http/https URL in `src/lib/env.ts:5-12`.
- **`/api/v1` is part of the env value, not of the code.** `getApiUrl` only strips trailing slashes and joins the path.
  So `apiFetch("auth/me")` becomes `<NEXT_PUBLIC_API_BASE_URL>/auth/me`.
- **No rewrites, no proxy, no route handlers for the backend.** `next.config.ts` in full contains only `images.remotePatterns`
  (Cloudinary) and `logging.fetches` — nothing else.
- Consequence: dev is a **cross-origin** call (frontend `:3000` → backend `:8080`), which is why `credentials: "include"`
  appears explicitly on the auth calls.

### 4.3 Envelope and pagination

`src/lib/api/schema/api-response.schema.ts`:

```ts
export const createApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
	z.object({ code: z.number().int(), message: z.string(), data: dataSchema });

export const nullDataResponseSchema = createApiResponseSchema(z.null());
```

`src/lib/api/schema/page-response.schema.ts`:

```ts
export const createPageResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
	z.object({
		content: z.array(itemSchema),
		page: z.number().int().nonnegative(),
		size: z.number().int().nonnegative(),
		totalElements: z.number().int().nonnegative(),
		totalPages: z.number().int().nonnegative(),
	});
```

- **Unwrapping** is `parseOrThrow(schema, payload, "…").data` — see `src/lib/api/parse.ts` (throws `ApiError` with
  status **500** when a 200 body breaks the contract, deliberately not the HTTP status).
- `DELETE` responses are HTTP 200 with `data: null` and are validated against `nullDataResponseSchema`
  (`products/admin/api/products.api.ts:185-189`).
- **Zero-based page:** the UI keeps a 1-based page and converts once, at the edge:

  ```ts
  export function toApiPage(page: number): number {
  	return Math.max(page - 1, 0);
  }
  ```
  `src/features/products/admin/model/listing-query.ts:161-163`. The same conversion appears inline in the storefront
  (`products/page.tsx:87`) and in orders (`Pagination current={page + 1}`, `onChange={(n) => setPage(n - 1)}`).
- Backend page defaults and the `size` cap are documented in `docs/api-contract.md` § Pagination: `page=0`, `size=20`,
  `maxPageSize=100` and **a larger `size` is silently clamped, not rejected**.

### 4.4 Error handling, status by status

`ApiError.status` is the only branch point. There is **no global error mapper and no global toast** — every call site
decides. The two helpers that encode the rule:

```ts
// src/features/auth/api/auth.api.ts:13-17
export function getAuthErrorMessage(error: unknown): string {
	return error instanceof ApiError && error.status > 0
		? error.message
		: "Unable to reach the server. Please check your connection and try again.";
}
```

```ts
// src/features/products/admin/model/api-error.ts:20-35
export function apiErrorMessage(caught: unknown, fallback: string): string {
	return caught instanceof ApiError && caught.status > 0 ? caught.message : fallback;
}

export function isConflict(caught: unknown): caught is ApiError {
	return caught instanceof ApiError && caught.status === 409;
}
```

| Status | Current behaviour | Evidence |
|---|---|---|
| **0** (transport) | Generic "check your connection" copy, never the fetch error text | `getAuthErrorMessage`, `apiErrorMessage` |
| **400** | Backend `message` shown verbatim | `getErrorMessage` reads `message` |
| **401** | **Per-caller only.** Login maps it to a password field error; `addToCart` returns `{status:"unauthorized"}`; account page branches on it. No refresh, no redirect. | `login-form.tsx:76-79`, `cart.api.ts:94`, `account/page.tsx:229` |
| **403** | Body is **empty** on permission failure, so only the fallback text exists: `"API request failed with HTTP status 403."` | `docs/api-contract.md` § Permissions |
| **404** | Treated as a distinct state where it matters (`ProductEditScreen` → `Result status="404"`; login → "The account does not exist") | `product-edit-screen.tsx:52-55`, `login-form.tsx:71-74` |
| **409** | `message` shown verbatim. For field-level conflicts the message is moved onto the field via `form.setFields([{ name, errors: [msg] }])` | `product-create-form.tsx:115-119`, `variant-create-modal.tsx:72-77` |
| **429** | **No special handling.** Falls through to `message` from the body (`{code:429,data:null}`) or the generic status text. Rate-limit windows are documented in `docs/api-contract.md` § Auth | grep: no `429` in `src/` |
| **500** | Also used locally for contract violations (`parseOrThrow`) | `src/lib/api/parse.ts:25-29` |

### 4.5 Cookies / `credentials`

`credentials: "include"` is set **explicitly and only** on the cookie-dependent auth calls:

- `auth/login` (`auth.api.ts:35`), `auth/google` (`:45`), `auth/refresh` (`:67`), `auth/change-password` (`:107`),
  `auth/logout` (`:114`).

All other calls rely on the `Authorization: Bearer <accessToken>` header (`getAuthHeaders()`), because `fetch`'s
default `credentials: "same-origin"` will not send a cross-origin cookie. This matters if you add a
`POST /users/{id}/lock` — it does **not** need `credentials`, only the bearer header.

### 4.6 API modules → endpoints

| File | Function | Method + path (relative to `NEXT_PUBLIC_API_BASE_URL`) |
|---|---|---|
| `src/features/auth/api/auth.api.ts` | `login` | `POST auth/login` |
| | `loginWithGoogle` | `POST auth/google` |
| | `register` | `POST auth/register` |
| | `refreshSession` | `POST auth/refresh` |
| | `getMe` | `GET auth/me` |
| | `updateProfile` | `PATCH auth/me` |
| | `changePassword` | `POST auth/change-password` |
| | `logout` | `POST auth/logout` |
| `src/features/products/api/products.api.ts` | `listProducts` | `GET products?keyword&category_id&min_price&max_price&status&sort&page&size` |
| | `getProductDetailBySlug` | `GET products/{slug}?page&size` (review paging) |
| | `getCategories` | `GET categories?page&size` (walks pages) |
| `src/features/products/admin/api/products.api.ts` | `listAdminProducts` | `GET products?…` (with auth headers) |
| | `getAdminProductDetailBySlug` | `GET products/{slug}` (with auth headers) |
| | `createProduct` | `POST products` |
| | `patchProduct` | `PATCH products/{productId}` |
| | `putProduct` | `PUT products/{productId}` |
| | `deleteProduct` | `DELETE products/{productId}` |
| `src/features/products/admin/api/variants.api.ts` | `createVariant` | `POST variants` |
| | `patchVariant` | `PATCH variants/{variantId}` |
| | `deleteVariant` | `DELETE variants/{variantId}` |
| `src/features/products/admin/api/attributes.api.ts` | `listAttributes` | `GET attributes?page&size` |
| | `listAttributeValues` | `GET attributes/{attributeId}/values?page&size` |
| | `addProductAttribute` | `POST product-attributes` |
| | `removeProductAttribute` | `DELETE product-attributes/{productValueId}` |
| | `addVariantAttribute` | `POST variant-attributes` |
| | `removeVariantAttribute` | `DELETE variant-attributes/{variantValueId}` |
| `src/features/products/admin/api/media.api.ts` | `uploadProductThumbnail` | `POST uploads/products/{productId}/thumbnail` (multipart `file`) |
| | `uploadVariantImage` | `POST uploads/variants/{variantId}` (multipart `file`) |
| `src/features/cart/api/cart.api.ts` | `getCart` | `GET cart` |
| | `addToCart` | `POST cart/items` |
| | `updateCartItem` | `PATCH cart/items/{cartItemId}` |
| | `removeCartItem` | `DELETE cart/items/{cartItemId}` |
| | `checkoutCart` | `POST cart/checkout` |
| | `createVnpayPaymentUrl` | `POST payments/vnpay/{orderId}` |
| `src/features/orders/api/orders.api.ts` | `listOrders` | `GET orders?page&size&status&q&createdAfter` |
| | `getOrder` | `GET orders/{orderId}` |

**No module calls `/users`, `/roles`, or `/permissions`.** NOT FOUND.

### 4.7 Shared types and Zod schemas

| Kind | Location | What exists |
|---|---|---|
| Envelope / page | `src/lib/api/schema/{api-response,page-response}.schema.ts` | `createApiResponseSchema`, `nullDataResponseSchema`, `createPageResponseSchema` |
| Status enums | `src/lib/api/schema/enums.schema.ts` | `UserStatusSchema = z.enum(["ACTIVE","LOCKED","DELETED"])`, `ProductStatusSchema`, `OrderStatusSchema`, `PaymentMethodSchema`, `PaymentStatusSchema`, `AdminStatusSchema`, `EmployeeStatusSchema`, `Notification*` |
| Derived unions | `src/types/index.ts` | `UserStatus`, `ProductStatus`, `OrderStatus`, … (`z.infer`) |
| Label maps | `src/lib/constants/labels.ts` | `USER_STATUS_LABELS = {ACTIVE:"Active", LOCKED:"Locked", DELETED:"Deleted"}`, `PRODUCT_STATUS_LABELS`, … |
| Current user DTO | `src/features/auth/schema/auth.schema.ts` | `meDataSchema` (below) |
| Product DTOs | `src/features/products/schema/catalog.schema.ts` | `ProductSchema`, variants, attributes, categories |
| Order DTOs | `src/features/orders/schema/order.schema.ts` | `OrderSchema`, `OrderPageSchema` |
| Cart DTOs | `src/features/cart/schema/cart.schema.ts` | cart + item + checkout |

**`User`, `Role`, `Permission`, `UserPage`, `RolePage` DTO schemas: NOT FOUND.** The only user shape is `MeData`:

```ts
export const meDataSchema = z.object({
	userId: z.string(),
	email: z.string(),
	name: z.string(),
	phone: z.string().nullable(),
	address: z.string().nullable(),
	roleCode: z.string(),
	roleName: z.string(),
	permissions: z.array(z.string()),
	hasPassword: z.boolean(),
});
```

`src/features/auth/schema/auth.schema.ts:12-22`. It is **strict in practice** — any missing field makes `parse` throw
(see `auth-store.ts:62`), so the admin user DTO you add should not be assumed to share these fields.

`UserStatus` already exists and is unused by any feature — `grep` finds it only in `enums.schema.ts`, `types/index.ts`
and `labels.ts`. That is the one piece of admin-user groundwork already present.

---

## 5. AUTHENTICATION & AUTHORIZATION

### 5.1 Token storage and attachment

`src/features/auth/session.ts` (full, 21 lines) — the access token is a **module-scoped variable**, nothing more:

```ts
/**
 * Access token lives in memory only. The refresh token is an HttpOnly cookie,
 * so a reload restores the session through `refreshSession()` in the auth store.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string) { accessToken = token; }
export function getAccessToken(): string | null { return accessToken; }
export function clearSession() { accessToken = null; }

export function getAuthHeaders(): Record<string, string> {
	return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
```

- **Not** in `localStorage`, **not** in `sessionStorage`, **not** in a cookie, **not** in the Zustand store.
- Lost on full reload → restored by `refreshSession()` in `AuthStore.hydrate()`.
- Attached per call: `headers: getAuthHeaders()` (every admin/cart/order module).

### 5.2 Refresh and 401 — what actually happens

Login/refresh shapes (`src/features/auth/schema/auth.schema.ts:4-10`):

```ts
export const loginDataSchema = z.object({
	accessToken: z.string().min(1),
	expiresIn: z.number(),
	tokenType: z.string(),
});
export const loginResponseSchema = createApiResponseSchema(loginDataSchema);
```

`refreshSession()` posts **no body**, only the cookie:

```ts
export async function refreshSession() {
	const payload = await apiFetch<unknown>("auth/refresh", {
		method: "POST",
		credentials: "include",
	});
	return loginResponseSchema.parse(payload).data;
}
```

**There is no 401 interceptor.** Concretely:

- No request queue during refresh, no retry-after-refresh, no "refresh once then replay" logic. `grep 401` in `src/`
  returns only call-site branches (§4.4).
- Refresh happens in exactly two places: `AuthStore.hydrate()` (first mount, e.g. `SiteHeader`'s `useEffect`) and
  `AuthStore.revalidate()` (called by `AdminPortalGuard` on mount).
- A request that 401s mid-session surfaces as an error state / toast at that call site. The user is **not** redirected
  and **not** signed out globally.
- `expiresIn` is parsed but **never used** — nothing schedules a proactive refresh, so the 15-minute lifetime is
  effectively "until a request fails".

### 5.3 Auth store (full)

`src/stores/auth-store.ts`:

```ts
"use client";

import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import { getMe, logout, refreshSession } from "@/features/auth/api/auth.api";
import type { MeData } from "@/features/auth/types";
import { clearSession, getAccessToken, setAccessToken } from "@/features/auth/session";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthState = {
	user: MeData | null;
	status: AuthStatus;
	sessionReady: boolean;
	hydrate: () => Promise<void>;
	revalidate: () => Promise<void>;
	setUser: (user: MeData) => void;
	signOut: () => Promise<void>;
};

let hydration: Promise<void> | null = null;
let revalidation: Promise<void> | null = null;

function isTransportError(error: unknown): boolean {
	return error instanceof ApiError && error.status === 0;
}

export const useAuthStore = create<AuthState>((set, get) => ({
	user: null,
	status: "loading",
	sessionReady: false,

	hydrate: () => {
		if (get().status === "authenticated") return Promise.resolve();
		if (hydration) return hydration;
		hydration = (async () => {
			try {
				const session = await refreshSession();
				setAccessToken(session.accessToken);
				set({ sessionReady: true });
				set({ user: await getMe(), status: "authenticated" });
			} catch {
				clearSession();
				set({ user: null, status: "anonymous", sessionReady: true });
			} finally { hydration = null; }
		})();
		return hydration;
	},

	revalidate: () => {
		if (revalidation) return revalidation;
		revalidation = (async () => {
			try {
				if (getAccessToken() !== null) {
					try {
						set({ user: await getMe(), status: "authenticated", sessionReady: true });
						return;
					} catch (error) {
						if (isTransportError(error)) throw error;
					}
				}
				const session = await refreshSession();
				setAccessToken(session.accessToken);
				set({ sessionReady: true });
				set({ user: await getMe(), status: "authenticated" });
			} catch {
				clearSession();
				if (get().user === null) set({ status: "anonymous", sessionReady: true });
			} finally { revalidation = null; }
		})();
		return revalidation;
	},

	signOut: async () => {
		await logout();
		clearSession();
		set({ user: null, status: "anonymous" });
	},

	setUser: (user) => set({ user, status: "authenticated" }),
}));
```

Design points worth preserving in a new feature:

- In-flight promises are memoised (`hydration`, `revalidation`) so N mounts make one request.
- A **transport** failure never signs the user out (`isTransportError`); only an HTTP rejection does.
- `sessionReady` exists so cart/order views can start loading before the profile resolves.

### 5.4 Does `user` carry `roleCode` and `permissions`?

**Yes.** `MeData` includes `roleCode: string`, `roleName: string`, `permissions: string[]`, plus `userId`, `email`,
`name`, `phone`, `address`, `hasPassword`.

Server-side reality (`docs/api-contract.md` § Auth):

> `GET /auth/me` returns the account's `permissions[]` and its `roleCode` **lowercase** (`"customer"`, not `"CUSTOMER"`).

The frontend folds case for exactly that reason (`src/features/auth/model/access.ts`):

```ts
const CUSTOMER_ROLE_CODE = "CUSTOMER";

export function isCustomerAccount(roleCode: string): boolean {
	return roleCode.toUpperCase() === CUSTOMER_ROLE_CODE;
}

export function isCompanyAccount(user: MeData | null): boolean {
	return user !== null && !isCustomerAccount(user.roleCode);
}
```

### 5.5 Permission codes in the frontend — and what's missing

**A helper exists, but it is catalog-scoped, not generic.**

`src/features/products/admin/model/permissions.ts`:

```ts
export const CATALOG_PERMISSIONS = {
	productCreate: "product:create",
	productUpdate: "product:update",
	productDelete: "product:delete",
	variantCreate: "variant:create",
	variantUpdate: "variant:update",
	variantDelete: "variant:delete",
	attributeCreate: "attribute:create",
	attributeDelete: "attribute:delete",
	mediaCreate: "media:create",
} as const;

export type CatalogPermission = (typeof CATALOG_PERMISSIONS)[keyof typeof CATALOG_PERMISSIONS];

export function hasCatalogPermission(
	permissions: readonly string[] | null | undefined,
	permission: CatalogPermission,
): boolean {
	return permissions != null && permissions.includes(permission);
}
```

`src/features/products/admin/use-catalog-permissions.ts`:

```ts
export function useCatalogPermissions() {
	const permissions = useAuthStore((state) => state.user?.permissions);
	const can = useCallback(
		(permission: CatalogPermission) => hasCatalogPermission(permissions, permission),
		[permissions],
	);
	return { can, permissions };
}
```

The doc comment states the intended convention explicitly:

> Scoped to the catalog on purpose: the account's authority list is global, but which codes this feature knows about is
> not, so a second feature adds its own hook rather than inheriting a catalogue of unrelated permissions.

**NOT FOUND:** a generic `hasPermission` / `can()` / `<Can>` / `usePermission` / `PermissionGate` at `src/lib` or
`src/components` level. **NOT FOUND:** any occurrence of `user:read`, `user:create`, `user:update`, `user:delete`,
`role:read`, `role:update`, `role:create`, `role:delete` anywhere in the repo (`grep` across `*.ts,*.tsx,*.md` → no
matches). `docs/api-contract.md` § Permissions enumerates the known codes and **does not include any `user:*` or
`role:*` code**:

> `product:create/update/delete`, `variant:*`, `category:*`, `attribute:*`, `attribute-value:*`, `media:*`,
> `order:read/update/complete`, exposed by `GET /auth/me` as `permissions[]`

So the codes your brief names (`user:read|create|update|delete`) are **not verifiable from this repo** — they must be
confirmed against the backend.

### 5.6 Google sign-in

Present, storefront only. `src/components/auth/google-auth-option.tsx` loads Google Identity Services
(`https://accounts.google.com/gsi/client`) with `next/script`, renders Google's button into a hidden container, and on
credential calls `loginWithGoogle(idToken)` → `POST auth/google` → `setAccessToken` → `getMe` → `router.replace("/")`.

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` is **optional** (`env.ts:11`); when absent the component renders a custom button that
reports "Google sign-in is not available right now" instead of failing.

**Admin login has no Google option** — by design, because the backend rejects Google for non-customer accounts
(`docs/adr/0001-admin-portal-for-all-company-accounts.md`: *"Google sign-in is only available for customer accounts; use
email and password"*).

### 5.7 Admin login vs customer login

Two separate surfaces, one API:

| | Customer | Company |
|---|---|---|
| Route | `/login` → `src/app/(auth)/login/page.tsx` | `/admin/login` → `src/app/admin/login/page.tsx` |
| Form | `src/features/auth/storefront/components/login-form.tsx` (raw `<form>`, `TextField`/`PasswordField`) | `src/features/auth/admin/components/admin-login-form.tsx` (antd `Form`) |
| Google | yes | no |
| Role check | none | rejects `CUSTOMER` locally |
| Landing | `/` | `/admin/dashboard` |

Admin form, the operative block:

```tsx
const data = await login({ email, password: values.password });
setAccessToken(data.accessToken);

const user = await getMe();

if (isCustomerAccount(user.roleCode)) {
	// The token `auth/login` just minted is dropped locally and deliberately
	// not revoked: the refresh cookie is shared with the storefront.
	clearSession();
	useAuthStore.setState({ user: null, status: "anonymous" });
	setServerError(COMPANY_ACCOUNTS_ONLY);
	return;
}

// Nothing is written to the auth store until the role check passes.
useAuthStore.getState().setUser(user);
router.replace("/admin/dashboard");
```

`src/features/auth/admin/components/admin-login-form.tsx:62-83`.

---

## 6. EXISTING FEATURE PATTERNS TO COPY

### 6.1 The reference feature: admin Products & Variants (list → create → edit)

This is the only complete admin feature and it is the pattern to mirror. Files:

| Layer | File |
|---|---|
| Route (server) | `src/app/admin/(shell)/products/page.tsx` — wraps the client listing in `<Suspense>` |
| Page component | `src/features/products/admin/components/products-listing.tsx` (510 lines) |
| URL/query model | `src/features/products/admin/model/listing-query.ts` (163 lines) |
| Row mapping | `src/features/products/admin/model/product-row.ts` |
| Toolbar | `src/features/products/admin/components/catalog-toolbar.tsx` |
| States | `src/features/products/admin/components/catalog-states.tsx`, `catalog-skeleton.tsx` |
| API | `src/features/products/admin/api/products.api.ts` |
| Create | `.../components/product-create-form.tsx` + `product-form-sections.tsx` + `model/product-form.ts` |
| Edit | `.../components/product-edit-screen.tsx` (loads) + `product-edit-form.tsx` (saves) |
| Permission hook | `.../use-catalog-permissions.ts` + `model/permissions.ts` |

**Why the route needs Suspense** (`products/page.tsx:11-21`):

```tsx
export default function AdminProductsPage() {
	return (
		<Suspense fallback={<CatalogListSkeleton />}>
			<ProductsListing />
		</Suspense>
	);
}
```

#### The fetch pattern (copy this shape)

`products-listing.tsx:48-158` — a discriminated union plus a `requestKey` that pins a response to the query that
produced it, so "loading" is derived rather than stored:

```tsx
type ListingState =
	| { status: "loading" }
	| { status: "error"; message: string; requestKey: string }
	| { status: "ready"; page: ProductPage; requestKey: string };

const requestKey = JSON.stringify([
	query.status, query.sort, query.keyword, query.category, query.page, reloadKey,
]);

const isFetching = state.status === "loading" || state.requestKey !== requestKey;

useEffect(() => {
	let active = true;
	listAdminProducts({ status: query.status, sort: query.sort, keyword: query.keyword,
		categoryId: query.category, page: toApiPage(query.page), size: LISTING_PAGE_SIZE })
		.then((page) => { if (active) setState({ status: "ready", page, requestKey }); })
		.catch((caught: unknown) => {
			if (!active) return;
			setState({ status: "error", requestKey,
				message: caught instanceof ApiError && caught.status > 0
					? caught.message
					: "Could not reach the server. Check your connection and try again." });
		});
	return () => { active = false; };
}, [query.status, query.sort, query.keyword, query.category, query.page, requestKey]);
```

Retry works by bumping a counter the effect watches (`reloadKey`), because `router.refresh()` would re-render without
re-requesting (`products-listing.tsx:89-94`, `:365-371`).

#### The three render states

```tsx
{state.status === "error" && !isFetching ? (
	<CatalogErrorState onRetry={() => setReloadKey((previous) => previous + 1)} message={state.message} />
) : isFetching ? (
	<CatalogListSkeleton />
) : rows.length === 0 ? (
	<CatalogEmptyState hasFilters={hasFilters}
		onClearFilters={() => router.replace(toListingHref(DEFAULT_LISTING_QUERY))} />
) : (
	<Table<ProductRow> rowKey="productId" dataSource={rows} columns={columns} pagination={false} … />
)}
```

`products-listing.tsx:365-410`. `CatalogErrorState` deliberately appends the server's own message under the fixed
reassurance copy, because a 403 and a dropped connection need different user responses
(`catalog-states.tsx:50-66`).

#### Table + footer pagination

```tsx
<Table<ProductRow>
	rowKey="productId"
	dataSource={rows}
	columns={columns}
	pagination={false}          // antd pagination is disabled; the footer owns it
	expandable={{ … }}
/>

<footer className={styles.pagination}>
	<Text type="secondary" aria-live="polite">
		Showing {firstShown}–{lastShown} of {page.totalElements} products
	</Text>
	<Pagination size="small" current={query.page} total={page.totalElements}
		pageSize={LISTING_PAGE_SIZE} showSizeChanger={false} simple
		onChange={(next) => updateQuery({ page: next })} />
</footer>
```

`products-listing.tsx:383-431`. Page-size is a **constant** (`LISTING_PAGE_SIZE = 20`), not a user control.

#### Filter bar

`catalog-toolbar.tsx:77-133` — search is a `<form>` (commit on submit, not per keystroke), selects apply immediately,
and below `md` the selects move into an antd `Drawer`:

```tsx
<form className={styles.searchForm} role="search"
	onSubmit={(event) => { event.preventDefault(); onKeywordSubmit(keywordDraft.trim()); }}>
	<Input className={styles.search} aria-label="Search products by name"
		prefix={<SearchOutlined />} placeholder="Search by product name…"
		value={keywordDraft} allowClear
		onChange={(event) => {
			setKeywordDraft(event.target.value);
			if (event.target.value === "") onKeywordSubmit("");   // clear = immediate reset
		}} />
</form>
```

The input also re-syncs from the URL during render (not in an effect) so "Clear filters" / back-button cannot leave stale
text behind (`catalog-toolbar.tsx:52-62`).

#### URL as state

`updateQuery` merges and `router.replace`s (`products-listing.tsx:188-198`), and the query model validates every param
before it can reach the API (`listing-query.ts:98-113`):

```ts
export function parseListingQuery(params: Record<string, unknown>): ListingQuery {
	return {
		keyword: parseKeyword(params.keyword),
		status: parseStatus(params.status),
		category: parseCategory(params.category),
		sort: parseSort(params.sort),
		page: parsePage(params.page),
	};
}
```

Defaults are omitted from the URL so the bare route stays clean (`toListingSearchParams`, `listing-query.ts:119-145`).

### 6.2 Second reference: order history (client-state list, debounce, requestKey)

`src/features/orders/storefront/components/order-history-view.tsx` (546 lines) — the pattern for a list whose filters do
**not** live in the URL:

- Filters in `useState`: `statusFilter`, `dateFilter`, `query`, `page` (0-based here).
- Debounced search, 300 ms, max 100 chars, with a visible `Alert` when over the limit
  (`order-history-view.tsx:52-53`, `:147-154`, `:381-387`).
- `requestKey` includes `status` so it does not fetch before the session resolves (`:139-141`).
- On success it clamps an out-of-range page: `if (page > lastPage) { setPage(lastPage); return; }` (`:172-176`).
- `status === "anonymous"` renders an `EmptyState` with a "Log In" button instead of an error (`:274-289`).
- Pagination converts 1-based antd → 0-based API inline (`:519-527`).

### 6.3 How forms are built

**antd `Form` + hand-written validators.** No react-hook-form, no Formik, no Zod resolver.

Two coexisting styles:

- **antd `Form`** — admin login, product create/edit, variant modal, attributes. Validation via `rules` with either
  inline `validator` callbacks or model functions wrapped per field.
- **Raw `<form>` + controlled inputs** — storefront login/register/account. Validation via `src/features/auth/model/validation.ts`.

Zod's role is **response validation only** (`parseOrThrow`), never form input.

Model-first validation, wrapped for antd (`variant-create-modal.tsx:88-97`):

```tsx
/** Wraps one model rule as an antd validator, so the field owns its message. */
function ruleFor(check: (value: never) => string | undefined) {
	return async (_: unknown, value: unknown) => {
		const error = check(value as never);
		if (error !== undefined) throw new Error(error);
	};
}
```

Submit + server-error placement (`product-create-form.tsx:93-129`):

```tsx
async function handleFinish(values: ProductFormValues) {
	// The button's `loading` is visual only: Enter in a text field and a rapid
	// double click both submit, and two POSTs would create two products.
	if (saveState.status === "saving") return;
	setSaveState({ status: "saving" });

	try {
		const created = await createProduct(toProductCreateInput({ ...values, status }));
		message.success(`"${created.name}" created as a draft.`);
		router.push(`${LISTING_PATH}/${created.slug}/edit`);
	} catch (caught) {
		const apiError = caught instanceof ApiError ? caught : null;

		// A duplicate slug belongs on its field, not in a banner.
		if (apiError?.status === 409) {
			form.setFields([{ name: "slug", errors: [apiError.message] }]);
			setSaveState({ status: "idle" });
			return;
		}

		setSaveState({ status: "error", message: apiError !== null && apiError.status > 0
			? apiError.message
			: "Could not reach the server. Check your connection and try again." });
	}
}
```

Form-level conventions: `layout="vertical"`, `requiredMark`, `scrollToFirstError={{ focus: true }}`, a footer
`saveBar` with an `aria-live="polite"` status line, and `disabled={saving}` on every input while saving
(`product-create-form.tsx:178-224`).

### 6.4 Destructive actions

Two mechanisms, both in use:

1. **`Popconfirm`** (antd) — used for delete in the edit form, media removal, variant delete:
   `product-edit-form.tsx:507-519`, `product-media-card.tsx:210-227`, `variants-table.tsx:471-488`.
2. **`ConfirmDialog`** (`src/components/dialogs/confirm-dialog.tsx`) — built on `Modal`, has `confirmLoading` and locks
   the dialog while loading (`closable={!confirmLoading}`, `mask={{ closable: false }}`, `keyboard={!confirmLoading}`).
   It is currently **not imported anywhere** — `grep` finds only its own definition.

Delete, end to end (`product-edit-form.tsx:299-316`):

```tsx
async function handleDelete() {
	setDeleting(true);
	try {
		await deleteProduct(product.productId);
		message.success(`"${product.name}" deleted.`);
		router.push(LISTING_PATH);
	} catch (caught) {
		setDeleting(false);
		message.error(
			caught instanceof ApiError && caught.status > 0
				? caught.message
				: "Could not delete the product. Please try again.",
		);
	}
}
```

Destructive UI is wrapped in a permission check (`{mayDelete && ( … )}`, `:498`) and the confirm button carries
`okButtonProps={{ danger: true }}` plus copy that states reversibility.

### 6.5 Toasts

`App.useApp().message` — never the static `message` import, because the static one cannot see the `ConfigProvider`
theme (`products-listing.tsx:76-78`). 17 call sites; `message.success` / `.error` / `.info` / `.warning` are all used.
The provider is `<App>` inside `<ConfigProvider>` in `src/app/providers.tsx:70-75`.

---

## 7. ADMIN / STAFF AREA STATUS

### 7.1 Every admin-related file and its completeness

| File | Completeness |
|---|---|
| `src/app/admin/page.tsx` | **done** — `redirect("/admin/dashboard")` |
| `src/app/admin/login/page.tsx` | **done** |
| `src/features/auth/admin/components/admin-login-form.tsx` (+ `.module.css`) | **done** |
| `src/app/admin/(shell)/layout.tsx` | **done** — guard + shell |
| `src/components/layout/admin-layout.tsx` (+ css) | **done** |
| `src/components/layout/admin-header.tsx` (+ css) | **done**, except search (inert) and notifications (static image) |
| `src/components/layout/admin-sidebar.tsx` (+ css) | **partial** — 11 items, 2 routable, 9 inert; no role/permission filtering |
| `src/components/layout/admin-portal-guard.tsx` (+ css) | **done** |
| `src/app/admin/(shell)/dashboard/page.tsx` (+ css) | **stub** — static heading + "will appear here once real admin data is wired up" |
| `src/app/admin/(shell)/products/page.tsx` | **done** — listing |
| `src/app/admin/(shell)/products/new/page.tsx` | **done** — create |
| `src/app/admin/(shell)/products/[slug]/edit/page.tsx` | **done** — edit |
| `src/features/products/admin/**` (api, model, components) | **done** — 20+ modules, all tested |
| User list / user detail / role screens / permission screens | **NOT FOUND** |
| Staff order screens | **NOT FOUND** (`Orders` sidebar item is inert) |
| Admin notifications | **NOT FOUND** |

### 7.2 TODO / FIXME / mock data

- `grep 'TODO|FIXME|HACK|XXX'` over `src/` → **no matches**.
- `grep 'TODO|FIXME'` over the repo's docs finds only prose about *contract* notes, not implementation TODOs.
- **No mock data files.** No MSW handlers, no `json-server`, no fixtures directory. Test files define their own literal
  fixtures inline (e.g. `products-listing.test.ts:16-32` builds an `anubias` product).
- The nearest thing to a placeholder is the dashboard copy (`dashboard/page.tsx:12-15`) and the admin header's
  notification bell comment (`admin-header.tsx:97`).
- **`.scratch/`** (the repo's issue tracker, `docs/agents/issue-tracker.md`) currently contains only
  `realtime-foundation/` (spec + issues 17–19). **No admin-user-management spec or tickets exist.**

---

## 8. CONFIG & ENVIRONMENT

### 8.1 `next.config.ts` (full)

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "res.cloudinary.com", pathname: "/ibk3z2nt/**" },
		],
	},
	logging: { fetches: { fullUrl: true, hmrRefreshes: true } },
};

export default nextConfig;
```

No `rewrites`, `redirects`, `headers`, `env`, or `basePath`. The Cloudinary hostname is scoped to one account path, so
any image URL from a different Cloudinary account will fail `next/image` until added.

### 8.2 Environment variables (names only)

| Name | Required | Exposure | Validated in |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | **required** | browser | `src/lib/env.ts:5-10` (must be a valid http/https URL) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | optional | browser | `src/lib/env.ts:11` |

That is the complete list — `getPublicEnv()` parses exactly these two keys (`env.ts:16-30`). `.env.local` exists and
contains exactly those two names. **`.env.example` does NOT exist** (`Get-ChildItem .env*` → only `.env.local`), even
though `AGENTS.md` §7.2/§10 and `FE_STATUS.md` §9 item 10 require it. That is a real doc/reality gap.

### 8.3 Dev connection and CORS

- `npm run dev` → `http://localhost:3000` (`README.md:17`; `playwright.config.ts:16-17` defaults to
  `http://127.0.0.1:3000`).
- Backend: `http://localhost:8080` with base path `/api/v1`, per `docs/api-contract.md:3-4` and `FE_STATUS.md` §2.
- **Direct cross-origin requests — no proxy.** Therefore:
  - every request must be CORS-allowed by the backend for `http://localhost:3000`;
  - cookie-dependent calls must send `credentials: "include"`, and the backend must allow credentials + that exact
    origin.
- **CORS cannot be verified from this repo** — the backend source path is absent and no backend runtime was contacted.

### 8.4 Mocking

**None.** No MSW, no `json-server`, no `__mocks__`, no mock API module. Every API module calls the real backend. Test
files stub `fetch`/modules per-test where needed (see `src/lib/api/client.test.ts`,
`src/features/products/admin/api/products.api.test.ts`).

---

## 9. TESTING & QUALITY

- **Runner:** Vitest 5 + jsdom + `@testing-library/react`. Config: `vitest.config.mts` — alias `@` → `./src`,
  `include: ["src/**/*.test.{ts,tsx}"]`. Tests are **colocated** beside the module (`AGENTS.md` §8).
- **Scale:** 27 test files under `src/` (e.g. `src/stores/auth-store.test.ts`, `src/lib/api/client.test.ts`,
  `src/features/products/admin/model/*.test.ts`, `src/features/products/admin/api/*.api.test.ts`).
- **Three testing styles in use:**
  1. **Pure model tests** — the dominant style. They assert *what the user sees*, not internals:
     `products-listing.test.ts:8-48` checks status labels/tones and the URL→query mapping.
  2. **Hook tests** — `renderHook` + driving the real Zustand store:
     `use-catalog-permissions.test.tsx:56-60` calls `useAuthStore.setState({ user })` with permission arrays copied
     from a real `GET auth/me`.
  3. **Component tests** — `@testing-library/react` render + user interaction:
     `order-history-view.test.tsx`, `cart-view.test.tsx`, `compatibility-card.test.tsx`.
- **API module tests** stub `fetch` and assert the exact URL + headers + envelope parsing
  (`src/features/products/admin/api/products.api.test.ts`).
- **E2E:** Playwright is configured (`playwright.config.ts`, three browsers, `webServer` runs `npm run dev`) but
  `e2e/` contains only `example.spec.ts` (the upstream sample). No app flow is covered.
- **Gate:** `npm run check` = lint → `antd lint` → typecheck → CSS-module check → encoding check → tests. The antd CLI
  exits 0 regardless of findings, which is why `scripts/lint-antd.mjs` converts counts into an exit code.

---

## 10. GAPS & RISKS

### 10.1 Missing for the feature you are about to build

| # | Gap | Evidence |
|---|---|---|
| 1 | **No admin user API module.** Nothing calls `/users`, `/roles`, `/permissions`. | §4.6 table; `grep` no matches |
| 2 | **No user/role/permission DTO schemas.** Only `MeData` exists. | §4.7 |
| 3 | **`user:*` / `role:*` permission codes are unverified and undocumented.** `docs/api-contract.md` § Permissions lists catalog/order codes only. | §5.5 |
| 4 | **No generic permission helper.** Only `useCatalogPermissions` + `hasCatalogPermission`, typed to catalog codes. A new feature is expected to add its own scoped hook. | §5.5 |
| 5 | **No `/admin/users` route**, no `PAGE_TITLES` entry, no routable sidebar item (`Customers` and `Staff & Permissions` are inert). | §3.1, §3.2 |
| 6 | **No role-based sidebar visibility.** ADR-0001 defers it; adding it is a new architectural decision, not a tweak. | §3.2 |
| 7 | **`UserStatus` exists but nothing consumes it** — no tone mapping like `productStatusTone`, no `StatusPill` variant for users. | §4.7, §2.3 |
| 8 | **No confirm dialog for lock/delete is wired up.** `ConfirmDialog` exists but has zero imports; the working pattern is `Popconfirm`. | §6.4 |
| 9 | **No 403 messaging.** The backend returns an empty body on permission failure, so the UI can only say "HTTP status 403". | `docs/api-contract.md` § Permissions |
| 10 | **No 429 handling** anywhere — relevant because login/refresh windows are team-wide and a 429 body is `data: null`. | §4.4 |
| 11 | **No `.env.example`**, despite AGENTS.md requiring it. | §8.2 |

### 10.2 Requirement-by-requirement risk review

**(a) Show/hide actions on `user:read|create|update|delete`**
- Mechanically trivial with the existing pattern: add a `USER_PERMISSIONS` map + `useUserPermissions()` hook copying
  `src/features/products/admin/{model/permissions.ts,use-catalog-permissions.ts}`.
- **Risk:** the codes may not exist on the backend. `permissions[]` comes from `/auth/me`; if the server never issues
  `user:update`, every check answers `false` and the whole screen renders read-only with no error. Verify with a live
  `GET /auth/me` for an Admin account before writing the hook.
- **Risk:** hiding is cosmetic only. `permissions.ts:1-9` states the rule the project follows — *"Never treat these as
  security: a hidden button is a courtesy, and the server does not consult it."*

**(b) 409 business-rule messages**
- The plumbing exists: `apiErrorMessage` / `isConflict` (`products/admin/model/api-error.ts`), and `getErrorMessage`
  already prefers the body's `message` for any non-2xx.
- **Risk:** `api-error.ts` lives **inside `features/products/admin/model/`**. Importing it from a users feature crosses
  feature boundaries, which `AGENTS.md` §7.4 discourages. Either promote it to `src/lib/api/` (a shared-foundation
  change, needs coordination) or duplicate the two small functions.
- **Risk:** 409 is used for *several* rules (duplicate email, last-admin protection, already-locked). A single field
  mapping is wrong for rules that belong to no field — those need a form-level `Alert` like
  `product-create-form.tsx:169-176`.

**(c) Zero-based pagination with `keyword`, `roleCode`, `status`, `sort=field,asc|desc`**
- Zero-based conversion has one precedent (`toApiPage`) and it is a **local** helper in
  `features/products/admin/model/listing-query.ts`, not shared. Reuse means importing across features or re-deriving.
- **`sort=field,asc|desc` is not the products convention.** `docs/api-contract.md` § Reading products says the product
  endpoint's `sort` is an enum (`newest|price_asc|price_desc`) and *"a Spring-style `sort=field,dir` is actively
  discarded, so it neither sorts nor errors"*. If the users endpoint follows Spring Data defaults it will accept
  `sort=email,asc`, but that is **unverified**. Getting this wrong fails silently (unsorted page, no error) — exactly
  the failure mode `listing-query.ts:6-14` was written to prevent.
- **Parameter naming is mixed in this repo:** products use snake_case (`category_id`, `min_price`), orders use
  `q`/`createdAfter` camelCase. Do not guess for users; read the controller or a live response.
- `size` is silently clamped at 100 (`docs/api-contract.md` § Pagination), so a "fetch all users" loop needs page
  walking like `attributes.api.ts:66-82`.

**(d) Locked account / token that stops working immediately**
- **This is the weakest area.** There is no 401 interceptor, no retry-after-refresh, and no global sign-out.
  A locked user's next request 401s; the component shows an error toast and the user stays on the page, apparently
  signed in. The only re-check is `AdminPortalGuard`'s `revalidate()` on mount (`admin-portal-guard.tsx:40-62`).
- The guard's 10 s timeout exists because `apiFetch` has **no request timeout** — a stalled `auth/me` would otherwise
  spin forever (`admin-portal-guard.tsx:14-19`).
- `expiresIn` from login is parsed but unused, so nothing refreshes at 15 minutes; the first failing request is the
  only signal.
- **Recommendation:** treat "401 while in the admin shell" as an explicit case in the new feature (sign out +
  `router.replace("/admin/login")` + a message), rather than relying on a global fix. A central interceptor would be a
  shared-foundation change affecting cart/orders/storefront and should be agreed first.

### 10.3 Inconsistencies and stale material

| Inconsistency | Detail |
|---|---|
| **Mixed error-message helpers** | `getAuthErrorMessage` (`features/auth/api/auth.api.ts`) and `apiErrorMessage` (`features/products/admin/model/api-error.ts`) implement the same rule twice. |
| **Mixed response validation** | Products/admin modules use `parseOrThrow`; orders and cart call `schema.safeParse` inline and hand-build `ApiError(…, 500, …)` (`orders.api.ts:42-50`, `cart.api.ts:142-149`). |
| **Mixed form styles** | antd `Form` (admin, checkout) vs raw `<form>` + `useState` (storefront login/register/account). |
| **Mixed list state** | URL-as-state (admin products, storefront products) vs local `useState` (order history). Both are defensible; pick per screen and say why. |
| **camelCase vs snake_case on the wire** | Response DTOs are camelCase (`productId`, `roleCode`); query params are mixed (`category_id`, `min_price`, `status`, `sort` vs `q`, `createdAfter`). `product-list-query.ts:11-13` warns that a wrong spelling is silently dropped by Spring. |
| **`FE_STATUS.md` is stale** | Dated 2026-11-05, it claims *"Sản phẩm | CHƯA CÓ … không có admin page/editor route"* and lists 16 routes. The products admin routes now exist (`src/app/admin/(shell)/products/**`). Do not trust its admin section. |
| **`docs/design.md` references missing artefacts** | It cites `.scratch/admin-products/screenshots/09-{listing,create,edit}-1440.png`; `.scratch/` now contains only `realtime-foundation/`. |
| **`src/styles/` is empty** | Only `.gitkeep`. `AGENTS.md` §3 lists it as a styling foundation; tokens actually live in `src/lib/design-tokens.ts`. |
| **`.env.example` missing** | Required by AGENTS.md §7.2, absent from the tree. |
| **`ConfirmDialog` unused** | Two confirmation mechanisms coexist; only `Popconfirm` is actually rendered. |
| **Dead-ish enum surface** | `AdminStatusSchema`, `EmployeeStatusSchema`, `NotificationStatusSchema`, `NotificationTypeSchema` and their label maps exist with no consumer — useful signal that a users/roles feature was anticipated, but also unused code to be careful not to "fix" accidentally. |

---

## QUICK FACTS

| Aspect | Value |
|---|---|
| **Framework** | Next.js 16.4.2 (`^16.4.2`) |
| **Router type** | App Router only (`src/app`), no `pages/`, **no `middleware.ts`** |
| **React** | 19.2.8 |
| **Language** | TypeScript, `strict: true` |
| **Package manager** | npm (`package-lock.json`); Node version not pinned |
| **UI lib** | Ant Design v6 (`antd ^6.6.5`) + `@ant-design/icons`; `@ant-design/nextjs-registry` for SSR |
| **Styling** | CSS Modules + `src/app/globals.css` + design tokens in `src/lib/design-tokens.ts` (CSS variables). **No Tailwind** |
| **HTTP client** | Native `fetch` wrapped by `apiFetch` in `src/lib/api/client.ts` (**no axios/SWR/React Query**) |
| **State / auth store** | Zustand — one store, `src/stores/auth-store.ts` |
| **Form lib** | None — antd `Form` + raw `<form>`/controlled inputs |
| **Validation lib** | Zod **for API responses only** (`parseOrThrow`); forms use hand-written validators |
| **Token storage** | Access token **in memory only** (`src/features/auth/session.ts`); refresh token expected as HttpOnly cookie `refresh_token` |
| **i18n** | **No** — English-only copy, `<html lang="en">` |
| **Permission helper** | **Partial** — `hasCatalogPermission` + `useCatalogPermissions` (catalog-scoped). No generic `can()`/`<Can>`/`usePermission` |
| **Existing admin layout** | **Yes** — `AdminPortalGuard` → `AdminLayout` (sidebar + header + breadcrumb) in `src/app/admin/(shell)/layout.tsx` |
| **Admin user management** | **Not found** — no route, API module, schema, or ticket |
| **Zero-based pagination helper** | `toApiPage` in `src/features/products/admin/model/listing-query.ts` (feature-local, not shared) |
| **409 handling** | `isConflict` + `apiErrorMessage` in `src/features/products/admin/model/api-error.ts` (feature-local) |
| **Test runner** | Vitest 5 + jsdom + Testing Library; 27 colocated `*.test.ts(x)`; Playwright configured but only the sample spec |
| **Gate command** | `npm run check` (lint → antd lint → typecheck → CSS check → encoding check → tests) |
