# Aquarium Store — Frontend

Next.js frontend for **Aquarium Store**, a headless aquarium e-commerce platform: the customer-facing storefront and the company-facing admin portal. Both talk to the Spring Boot backend, which lives in the companion repo [`DACN`](https://github.com/thedan85/DACN).

University coursework project (đồ án chuyên ngành).

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript 5**
- **Ant Design v6** (+ `@ant-design/nextjs-registry`) — component library and theme
- **Zustand** — client state · **Zod** — runtime validation at untrusted boundaries
- **CSS Modules** + shared design tokens (`src/app/globals.css`, `src/lib/design-tokens.ts`)
- **Vitest** + Testing Library — unit/component tests · **Playwright** — e2e
- **ESLint 9** (FlatCompat + `eslint-config-next`) · CSS-module reference checker (`npm run check:css`)

## Getting Started

```bash
npm ci              # install dependencies
cp .env.example .env.local
npm run dev         # http://localhost:3000
```

The app expects the backend API to be running (default `http://localhost:8080`). See `docs/commands.md` in the backend repo for how to start it.

Configuration is read from `.env.local` (never committed). Key variables:

| Variable | Public | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical site URL, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_API_BASE_URL` | yes | Backend base URL, e.g. `http://localhost:8080/api/v1` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | yes | Google OAuth Web client ID. Must equal the backend `GOOGLE_CLIENT_ID` (Google sign-in is for customers only) |

## Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint
- `npm run typecheck` — run `tsc --noEmit`
- `npm run check:css` — verify every CSS Module class referenced in source exists
- `npm run test` — run Vitest once
- `npm run check` — lint + typecheck + CSS-module check + tests (the gate to run before a PR)

`.githooks/pre-commit` runs the CSS check, ESLint on the staged files, the typecheck, and the tests on every commit. Enable it once per clone with `git config core.hooksPath .githooks`.

## Project structure

```text
src/
├── app/            App Router routes
│   ├── (storefront)/   customer-facing pages
│   ├── (auth)/         login / register
│   ├── admin/          admin portal (login + (shell) routes, e.g. /admin/orders)
│   └── api/            frontend-owned route handlers only (health/proxy)
├── features/       feature slices — each owns api/, components/, model/
├── components/     ui/ (domain-independent), layout/, feedback/, dialogs/
├── lib/            api client (src/lib/api/), env access, design tokens, utils
├── stores/         shared client state (Zustand)
├── styles/         shared styling foundations
└── types/          cross-feature TypeScript contracts
```

Feature-specific code stays in its `src/features/<feature>/` slice; shared code is promoted only when genuinely reusable.

## Documentation

- `AGENTS.md` — contributor guide for AI coding agents (architecture, conventions, security rules)
- `CODING_STANDARDS.md` — review-time coding standards
- `GLOSSARY.md` — project language and terms (Admin portal, Customer, Company account, ...)
- `docs/design.md` — design tokens, type scale, measured screens
- `docs/antd.md` — Ant Design theming, tokens, and override mechanics
- `docs/verification.md` — running checks, browser verification, committing
- `docs/adr/` — architecture decision records

## Architecture

Headless: the frontend is a pure client of the backend API — the only backend is the Spring Boot service in [`DACN`](https://github.com/thedan85/DACN). The storefront and the admin portal (company accounts, i.e. every role except Customer) are both served from this one app; business rules and permission enforcement (`product:*`, `order:*`, ...) live in the backend — the UI only reflects them. All backend communication goes through the centralized client in `src/lib/api/client.ts`; feature modules never recreate base URLs or auth headers.

Payments (VNPAY / MoMo / VietQR), media (Cloudinary), Google sign-in, and shipping (GHTK / GHN) are integrated through the backend; see `AGENTS.md` §6 before extending any of them.
