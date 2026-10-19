<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Development Environment and Command Execution

### Windows PowerShell Execution Policy

The frontend project is developed on Windows using PowerShell. Depending on the active PowerShell execution policy, npm commands invoked through PowerShell may fail because the `npm.ps1` script is blocked.

Before running npm commands in a PowerShell session, check whether the execution policy prevents npm from running.

If necessary, execute the following command in the **current PowerShell process**:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then run the required npm command, for example:

```powershell
npm run lint
npm run build
```

#### Rules for AI agents

- Apply the process-scoped execution-policy override only when required to run npm commands.
- Execute the override and the npm command in the same PowerShell session.
- `-Scope Process` limits the policy change to the current PowerShell process; it does not permanently modify the user's execution policy.
- Do not use `-Scope CurrentUser` or `-Scope LocalMachine` to work around this project-specific issue.
- Do not attempt to bypass organizational security restrictions or Group Policy. If the override is denied, report the restriction and use an approved alternative.
- If an npm command fails, inspect the actual error before deciding whether the execution policy is the cause.
- Do not repeatedly change the execution policy when the current session already permits npm execution.
- Do not claim that linting, type checking, tests, or builds passed unless the commands actually completed successfully.

#### Alternative

If PowerShell blocks `npm.ps1`, and the environment permits it, try invoking the Windows command shim directly:

```powershell
npm.cmd run lint
npm.cmd run build
```

This may avoid the PowerShell script execution-policy issue without changing the policy.

The required verification commands and their results must still be reported accurately.

# AGENTS.md — Frontend Project Instructions

## 1. Project Overview

### Project Name

Headless E-commerce with Product Information Management (PIM) and Touchless Fulfillment

### Project Purpose

This repository contains the frontend storefront for a headless e-commerce system developed as a university coursework project.

The frontend is responsible for presenting the storefront UI, managing client-side interactions, consuming backend APIs, and integrating with external services where appropriate.

The project follows a headless architecture:

- **Frontend:** Next.js storefront application.
- **Backend:** Java Spring Boot REST API maintained in a separate repository.
- **Database:** PostgreSQL hosted through Supabase, managed primarily by the backend.
- **Media storage:** Cloudinary.
- **Payment gateway:** VNPAY.
- **Authentication:** Google login or simple email + password.
- **Shipping and fulfillment:** Planned integration with shipping providers, subject to final backend architecture.

The frontend and backend are maintained in separate Git repositories. The frontend must communicate with the backend through documented APIs rather than directly accessing backend internals or the database.

### Core Objectives

- Build a maintainable, reusable, and responsive e-commerce storefront.
- Establish shared frontend foundations before parallel feature development.
- Integrate with the Spring Boot backend through a centralized API layer.
- Support product catalog browsing, product details, and other customer-facing shopping workflows as they are implemented.
- Support authentication, payment, product imagery, and fulfillment integrations.
- Keep shared UI, design tokens, types, API contracts, and configuration consistent across contributors.
- Prioritize technical correctness, framework knowledge, maintainability, and clear implementation boundaries.

### Project Status

The project is in its foundational setup and early implementation stage.

Existing foundations include the Next.js App Router structure, global styles, application layout, providers, error and loading boundaries, environment configuration, design tokens, and a centralized API client entry point.

Do not assume that a feature or integration is implemented merely because its directory, dependency, or configuration placeholder exists.

Before modifying an existing foundation, inspect the actual source files and current Git state.

---

## 2. Technology Stack

### Core Technologies

| Technology | Purpose |
|---|---|
| Next.js 16.3.8 | React framework, App Router, routing, rendering, and server-side capabilities |
| React 19.2.8 | UI composition and component lifecycle |
| TypeScript 5 | Static typing and maintainable application contracts |
| Node.js | JavaScript runtime and development tooling |
| npm | Package management and dependency scripts |
| CSS | Global styling, design tokens, and component styling |
| ESLint 9 | Static analysis and code quality |
| PostgreSQL / Supabase | Backend-managed data persistence; the frontend should not bypass the backend without an explicit architectural decision |
| Java Spring Boot 3.x | Backend REST API in a separate repository |

Use the versions declared in `package.json` and `package-lock.json` as the repository's current dependency baseline.

Do not upgrade major framework versions or replace libraries without checking compatibility and obtaining agreement when the change affects shared foundations.

### Installed npm Packages

#### Production Dependencies

| Package | Intended purpose |
|---|---|
| `next` | Application framework, App Router, route handlers, and rendering |
| `react` | Component-based UI |
| `react-dom` | React DOM rendering |
| `antd` | Ant Design component library |
| `@ant-design/nextjs-registry` | Ant Design integration with Next.js server rendering and style registration |
| `@ant-design/icons` | Ant Design icon components |
| `zod` | Runtime validation of environment variables, API responses, and other untrusted data where appropriate |
| `zustand` | Lightweight state management for shared client-side state |

#### Development Dependencies

| Package | Intended purpose |
|---|---|
| `typescript` | Type checking |
| `eslint` | Linting |
| `eslint-config-next` | Next.js-specific ESLint rules |
| `@types/node` | Node.js type definitions |
| `@types/react` | React type definitions |
| `@types/react-dom` | React DOM type definitions |

Do not assume that additional libraries such as Axios, TanStack Query, Zustand, React Hook Form, or an icon package are installed. Inspect the manifest before using them.

Prefer the existing stack unless a concrete requirement justifies another dependency.

### Available npm Scripts

- `npm run dev` — start the development server.
- `npm run build` — create a production build.
- `npm run start` — start the production server after a successful build.
- `npm run lint` — run ESLint.

Run the relevant checks after implementation. If a check fails, distinguish new failures from pre-existing issues and report the actual result.

---

## 3. Architecture and Directory Conventions

The current application uses the `src/` directory and Next.js App Router.

### Current Directory Responsibilities

```text
src/
├───app
├───components
│   ├───dialogs
│   ├───feedback
│   ├───layout
│   └───ui
├───features
├───hooks
├───lib
│   ├───api
│   ├───constants
│   └───utils
├───stores
├───styles
└───types
```

Follow the existing directory structure unless there is a clear architectural reason to change it.

### Directory Responsibilities

- `src/app/`: App Router pages, layouts, route-level loading and error boundaries, and frontend-owned route handlers.
- `src/components/ui/`: Reusable, domain-independent UI components.
- `src/components/feedback/`: Shared feedback UI such as loading indicators, empty states, error displays, and notifications.
- `src/hooks/`: Reusable React hooks that are not exclusively owned by a particular feature.
- `src/lib/api/`: Centralized API communication, HTTP configuration, and shared request behavior.
- `src/lib/utils/`: Reusable utility functions.
- `src/lib/env.ts`: Environment variable access and validation.
- `src/lib/design-tokens.ts`: Shared design-token definitions exposed to TypeScript.
- `src/stores/`: Shared client-side state stores, when needed.
- `src/styles/`: Shared styling foundations, including design tokens.
- `src/types/`: Shared application types and cross-feature contracts.
- `src/app/providers.tsx`: Application-level client providers and shared context integration.

Avoid placing all application logic in `page.tsx`, `layout.tsx`, or one large component.

Feature-specific implementation should remain cohesive. Promote code into shared directories only when it is genuinely reusable or belongs to an established shared foundation.

### Next.js Conventions

- Use the App Router; do not introduce the Pages Router.
- Prefer React Server Components by default.
- Add `"use client"` only when browser APIs, client-side state, effects, event handlers, or client-only libraries require it.
- Keep server-only code out of Client Components.
- Do not expose secret environment variables through client bundles.
- Use route handlers only for frontend-owned server endpoints, such as a health endpoint or a deliberate backend proxy.
- Do not create duplicate frontend endpoints for backend functionality without an explicit reason.
- Follow the installed Next.js version's current documentation and API conventions.

---

## 4. Frontend Design and UI Rules

### Component Strategy

Use Ant Design as the established UI component library.

- Prefer existing Ant Design components over introducing a competing component library.
- Wrap frequently reused components in project-specific components when this provides consistent behavior, styling, or interfaces.
- Keep domain-independent components separate from business-specific feature components.
- Avoid unnecessary abstraction for components used only once.
- Keep component props explicit and typed.
- Avoid duplicating layout, form, table, modal, and feedback patterns across features.

### Styling

The shared styling foundations include:

- `src/app/globals.css`
- `src/lib/design-tokens.ts`

These files must remain consistent.

- Reuse established design tokens for colors, spacing, typography, radii, and other shared design decisions.
- Do not scatter arbitrary design values across multiple features when a shared token already exists.
- Avoid introducing another global CSS system or design-token source without agreement.
- Avoid broad global selectors that unexpectedly affect unrelated features.
- Keep component-specific styling close to its component where appropriate.
- Consider responsive layouts, keyboard navigation, focus visibility, and accessible form controls.
- Follow the existing Ant Design theme and provider configuration.

### Accessibility and User Feedback

- Use semantic HTML and accessible labels.
- Support keyboard interaction for interactive elements.
- Provide appropriate loading, empty, success, and error states.
- Avoid silent failures when an API request or user action fails.
- Do not rely on color alone to communicate status.

---

## 5. Backend API Integration

The backend is a separate Java Spring Boot REST API. Frontend code must treat backend communication as an explicit integration boundary.

### Centralized API Client

Use `src/lib/api/client.ts` as the established entry point for shared HTTP behavior.

Before implementing a new request, inspect the existing client and determine whether it already supports the required functionality.

The API layer should centralize applicable behavior such as:

- Base URL configuration.
- Request and response handling.
- JSON serialization and deserialization.
- HTTP error normalization.
- Authentication handling when the agreed authentication mechanism is available.
- Request headers and content types.
- Timeouts or cancellation where appropriate.
- Validation of untrusted response data where justified.

Feature code should not independently recreate the base URL, authentication headers, or common error-handling rules.

Use feature-specific API modules or service functions to keep endpoints organized.

### API Contracts

- Confirm endpoint paths, HTTP methods, request schemas, response schemas, pagination conventions, and error formats against backend documentation or agreed contracts.
- Do not invent endpoints or assume response fields.
- Do not use `any` as a shortcut for unknown response shapes.
- Use shared TypeScript types where contracts cross feature boundaries.
- Keep frontend types aligned with the actual backend contract.
- Distinguish transport errors, HTTP errors, validation failures, and successful responses.
- Do not treat a successful HTTP status as proof that the returned payload is valid.
- Do not hardcode mock responses into production API functions.

If an endpoint is not ready, define the missing contract explicitly and use clearly identified development fixtures only when needed for UI development.

### Environment Configuration

Use `src/lib/env.ts` as the established environment configuration entry point.

- Use `.env.example` to document required environment variable names and safe example values.
- Keep real credentials and secrets out of Git.
- Never expose backend secrets or third-party secret keys in browser-side code.
- Use `NEXT_PUBLIC_` only for values intentionally exposed to the browser.
- Validate required configuration early and provide actionable error messages.
- Do not silently replace missing production configuration with localhost URLs or fake credentials.

The backend base URL variable name and its final validation rules must follow the existing implementation.

---

## 6. Planned External Integrations

These integrations are part of the project scope, but their implementation status must be verified before extending them.

### 6.1 VNPAY Payment Gateway

Purpose: allow customers to initiate payment through VNPAY as part of the checkout process.

Expected frontend responsibilities:

- Display the applicable payment method and payment status.
- Collect the necessary checkout information.
- Request payment initiation through the backend API.
- Handle the payment redirect or URL returned by the backend.
- Handle return or result pages according to the agreed payment flow.
- Display pending, successful, failed, or cancelled states when those states are supported by the backend contract.

Security rules:

- Payment initiation and payment verification must follow the backend's agreed integration design.
- Never implement VNPAY signature generation using secret credentials in browser code.
- Do not trust client-side query parameters or redirect pages as authoritative proof of payment.
- Treat the backend's verified payment result as the source of truth.
- Prevent duplicate user submissions where appropriate, but do not mistake UI-level button disabling for transaction-level idempotency.

The exact endpoint contract, payment lifecycle, and return URL configuration remain subject to backend agreement.

### 6.2 Cloudinary Media

Purpose: serve product imagery and other supported storefront media.

Expected frontend responsibilities:

- Render image URLs provided by the backend or approved content source.
- Use responsive image sizing and appropriate loading behavior.
- Handle missing, invalid, or unavailable images gracefully.
- Follow the project's agreed Next.js image configuration and Cloudinary domain allowlist.

Security and architecture rules:

- Do not expose Cloudinary API secrets or upload secrets to the browser.
- Do not invent public upload permissions or assume unrestricted direct uploads.
- Direct uploads, signed uploads, upload presets, and image-management operations must follow the agreed backend or Cloudinary security design.
- Do not hardcode temporary image URLs as permanent product data.
- Keep media configuration centralized where practical.

### 6.3 Google Login

Purpose: allow users to authenticate using a Google account.

Before implementation, confirm whether authentication is managed through the Spring Boot backend, a dedicated identity provider, or another approved architecture.

Expected frontend responsibilities may include:

- Initiating the agreed Google authentication flow.
- Displaying authentication and callback states.
- Handling login failures and cancellation.
- Maintaining the frontend's authenticated-user state using the agreed mechanism.
- Supporting logout and protected-route behavior where required.

Security rules:

- Never treat a user-provided email address or client-side profile object as proof of authentication.
- Never expose OAuth client secrets.
- Do not store sensitive authentication tokens in local storage without an explicit, reviewed security decision.
- Follow the backend's session, cookie, token, redirect URI, and CSRF requirements.
- Do not independently introduce a second authentication architecture.

### 6.4 Shipping and Fulfillment

Purpose: support the storefront's order and fulfillment workflow through the backend.

Potential providers include GHTK and GHN, subject to the final project design.

The frontend may display shipping options, estimated fees, address information, order tracking, and fulfillment status when supported by backend APIs.

Rules:

- The frontend must not contain shipping-provider secret credentials.
- Shipping calculations and booking operations must follow the backend contract.
- Do not fabricate delivery fees, tracking numbers, or shipment statuses.
- Use sandbox data and endpoints for development where applicable.
- Keep provider-specific details out of shared UI components when a common shipping interface is sufficient.

### 6.5 Other Integrations

Additional integrations, authentication methods, or third-party services:

- Status:
- Purpose:
- Relevant environment variables:
- Backend endpoints:
- Security considerations:
- Documentation:

---

## 7. Foundational Files and Parallel Development Rules

This section takes priority when a change affects multiple contributors or features.

### 7.1 Definition of a Foundation

A foundation is a shared configuration, convention, contract, or utility that feature branches depend on.

Examples include:

- TypeScript configuration.
- ESLint configuration.
- Next.js configuration.
- Root application layout.
- Application providers.
- Global styles and design tokens.
- Environment variable conventions.
- Centralized API client.
- Shared error-handling conventions.
- Shared TypeScript types and API contracts.
- Shared UI component interfaces.
- Authentication and route-protection conventions.
- Common package dependencies and lockfile.

A foundation must be sufficiently implemented, verified, documented, and merged into `dev` before dependent feature work is distributed in parallel.

### 7.2 Foundation Finalization Gate

Before a foundational task is declared complete, verify the following:

- [ ] The implementation exists; it is not just a placeholder.
- [ ] The implementation compiles and behaves as intended.
- [ ] Its public interface and usage conventions are documented.
- [ ] Required environment variables are documented in `.env.example`.
- [ ] No real secrets or machine-specific configuration have been committed.
- [ ] Relevant TypeScript checks, linting, builds, or focused tests pass.
- [ ] Dependencies are declared correctly in `package.json`.
- [ ] `package-lock.json` is synchronized with dependency changes.
- [ ] The changes are committed and pushed to the shared `dev` branch.
- [ ] Dependent contributors know which commit or updated branch to use.

A placeholder file or empty directory does not count as an implemented foundation.

If a required foundation is not ready, either finish it first or explicitly document the agreed temporary interface and limitations.

### 7.3 Foundation Change Control

Treat the following files as shared infrastructure:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next.config.ts`
- `eslint.config.mjs`
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/app/globals.css`
- `src/lib/design-tokens.ts`
- `src/lib/env.ts`
- `src/lib/api/client.ts`

The list is not exhaustive. Other shared contracts and configuration files may also qualify.

Rules:

1. Inspect the latest `dev` branch before changing a shared foundation.
2. Prefer one designated owner or coordinated change for each shared foundation.
3. Do not independently redesign the same foundation on multiple feature branches.
4. Agree on public interfaces before feature contributors implement against them.
5. Keep changes narrowly scoped and backward-compatible where possible.
6. Communicate breaking changes before merging them.
7. Push finalized foundations to `dev` so other contributors can rebase or merge the updated branch.
8. If a foundation changes during active feature development, notify dependent contributors and coordinate integration.
9. Do not force-push shared branches or overwrite another contributor's changes.
10. Never commit local environment files containing credentials.

### 7.4 Parallel Feature Development

Once the necessary foundations are available in `dev`, feature contributors may work independently.

Each feature should:

- Use the existing folder and naming conventions.
- Depend on the shared API client and design system rather than implementing duplicates.
- Own its feature-specific components, hooks, services, and state where practical.
- Avoid modifying unrelated foundational files.
- Avoid changing another feature's public interfaces without coordination.
- Use agreed TypeScript contracts when an endpoint is still under development.
- Document unresolved backend dependencies.
- Rebase or merge from the latest `dev` before final integration, following team conventions.
- Run relevant checks before opening a pull request.

### 7.5 Dependency Changes

Installing a new npm package changes shared project infrastructure.

- Check whether the existing stack already provides the required functionality.
- Explain why the new dependency is necessary.
- Check compatibility with the current Next.js, React, and TypeScript versions.
- Coordinate changes to `package.json` and `package-lock.json`.
- Do not manually edit the lockfile.
- Avoid having multiple branches independently add, remove, or upgrade the same dependency.
- Verify the build and lint after dependency changes.

### 7.6 Pull Request and Integration Expectations

Before merging a feature branch into `dev`:

- [ ] The feature follows the agreed architecture.
- [ ] Shared foundations have not been changed without coordination.
- [ ] Types and API contracts are consistent with the backend.
- [ ] No credentials or sensitive environment files are included.
- [ ] Relevant linting, type checks, and build checks have been performed.
- [ ] Loading, empty, and error states are handled where applicable.
- [ ] Conflicts with recent `dev` changes are resolved.
- [ ] Known limitations and incomplete integration points are documented.

Team-specific branch naming, review requirements, and merge strategy:

- Branch naming convention:
- Pull request requirements:
- Required reviewers:
- Merge strategy:
- CI checks:

---

## 8. TypeScript and Code Quality

- Keep TypeScript strictness consistent with `tsconfig.json`.
- Avoid `any`; use explicit types, generics, `unknown`, or schema validation as appropriate.
- Prefer type-safe function interfaces and predictable return values.
- Avoid unnecessary type assertions and non-null assertions.
- Use Zod when runtime validation provides meaningful protection at untrusted boundaries.
- Use Zustand when shared client state is genuinely cross-component; otherwise, prefer local React state.
- Do not duplicate types that can be imported from a shared contract module.
- Avoid circular imports and unclear module dependencies.
- Keep functions and components focused on a single responsibility.
- Use descriptive names for components, hooks, functions, and variables.
- Avoid introducing abstractions that are more complex than the problem they solve.
- Follow the existing ESLint rules rather than disabling rules to silence errors.
- Remove unused code and imports.
- Add tests when a test framework and appropriate test conventions are established.

---

## 9. State Management and Data Fetching

Use the simplest state-management approach that fits the requirement.

- Prefer local React state for component-specific UI behavior.
- Use URL search parameters for state that should be shareable or survive navigation, such as filters and pagination, when appropriate.
- Introduce shared stores only for genuinely cross-component client state.
- Do not add a new state-management library without agreement.
- Avoid duplicating server-owned data in client stores without a clear reason.
- Establish consistent loading, error, and stale-data behavior for API-driven UI.
- Keep server-side and client-side data fetching responsibilities explicit.
- Do not make unnecessary requests during rendering.
- Avoid fetching the same data independently in multiple components when the architecture permits reuse.

The final data-fetching and caching conventions:

- Server-side fetching:
- Client-side fetching:
- Cache and revalidation policy:
- Shared client-state policy:

---

## 10. Security and Environment Variables

- Treat all browser input, URL parameters, API responses, and user-provided data as untrusted.
- Keep secrets on the server.
- Do not commit `.env.local` or real credentials.
- Maintain `.env.example` with safe example values and clear documentation.
- Avoid logging tokens, passwords, payment credentials, or personal information.
- Do not bypass backend authorization by hiding or disabling UI elements.
- Do not treat client-side validation as a replacement for backend validation.
- Use safe rendering practices and avoid unsafe HTML injection.
- Follow the agreed authentication, authorization, and payment security boundaries.
- Validate redirects and callback URLs according to the relevant security requirements.

Required environment variables and their ownership:

| Variable | Purpose | Public or server-only |
|---|---|---|
| `NEXT_PUBLIC_*` | Browser-exposed configuration, only where necessary | Public |
| Backend API base URL | Backend communication | Depends on actual usage |
| Google authentication configuration | Authentication integration | Depends on architecture |
| Cloudinary configuration | Media delivery or upload integration | Depends on operation |
| VNPAY configuration | Payment integration | Secret signing configuration must remain server-side |

This table is illustrative. The actual variable names, required status, and exposure rules must be defined in `.env.example` and `src/lib/env.ts`.

---

## 11. Error Handling and Observability

Use the existing error boundaries and feedback components wherever appropriate.

- `src/app/error.tsx`: route-level error handling.
- `src/app/global-error.tsx`: application-level error handling.
- `src/app/loading.tsx`: route-level loading UI.
- `src/app/not-found.tsx`: not-found handling.
- `src/components/feedback/`: shared feedback UI.

Rules:

- Do not swallow errors silently.
- Do not expose internal stack traces, secret values, or sensitive backend details to end users.
- Display user-facing messages that explain the problem and, where appropriate, the next action.
- Preserve useful diagnostic information in development without leaking sensitive data in production.
- Distinguish recoverable UI errors from authentication, validation, network, and server failures.
- Avoid duplicating error-handling logic across features.

Logging and monitoring conventions:

- Logging strategy:
- Production error reporting:
- Request correlation:
- Sensitive-data redaction:

---

## 12. Documentation and Decision Making

When a task depends on an undocumented implementation detail:

1. Inspect the existing source code.
2. Check the project's `docs/` directory and README.
3. Consult the official documentation for the installed framework or library version.
4. Verify backend contracts with the backend team when applicable.
5. Avoid inventing APIs, configuration properties, or response formats.
6. Record decisions that affect multiple features or contributors.

Prioritize official documentation, especially for version-specific Next.js, React, TypeScript, Ant Design, Zod, and authentication APIs.

Do not upgrade dependencies simply because newer documentation uses a different API.

Architecture decisions and technical references:

- Frontend architecture:
- API contract documentation:
- Authentication flow:
- Payment flow:
- Media configuration:
- Coding conventions:
- Additional references:

---

## 13. Working Procedure for AI Coding Agents

Before modifying code:

1. Read this file.
2. Inspect the relevant source files and existing implementations.
3. Check the repository's current branch and working-tree changes.
4. Identify shared foundations that the task depends on.
5. Confirm API contracts and package availability.
6. Determine whether the task is feature-specific or foundational.
7. Avoid overwriting unrelated user changes.

During implementation:

- Make the smallest coherent change that satisfies the requirement.
- Reuse existing utilities, components, design tokens, and API conventions.
- Preserve established public interfaces unless a change is required.
- Do not generate placeholder implementations that appear production-ready.
- Do not invent backend endpoints or claim external integrations work without verification.
- Coordinate foundational changes before modifying shared infrastructure.
- Document assumptions and unresolved dependencies.

After implementation:

1. Review the diff for unintended changes.
2. Run relevant linting, type checks, tests, or production builds supported by the repository.
3. Fix issues introduced by the change.
4. Report the files changed, checks performed, and any known limitations.
5. Do not claim that a check passed if it was not run.
6. Do not commit or push changes unless explicitly authorized or required by the agreed task.

---

## 14. Project-Specific Conventions — To Be Completed

### Business and Functional Requirements

- Target users:
- Supported user roles:
- Core customer workflows:
- Product catalog requirements:
- Cart and checkout requirements:
- Order management requirements:
- Other requirements:

### Frontend Routing

- Route naming conventions:
- Public routes:
- Protected routes:
- Route groups:
- URL and query parameter conventions:

### API Contracts

- Backend base URL:
- API versioning:
- Request and response conventions:
- Pagination and filtering:
- Error response schema:
- Authentication mechanism:
- API documentation location:

### Design System

- Brand identity:
- Color palette:
- Typography:
- Spacing scale:
- Responsive breakpoints:
- Component naming:
- Accessibility requirements:

### Authentication and Authorization

- Google OAuth flow:
- Session or token strategy:
- Token storage:
- Protected-route strategy:
- Logout behavior:
- Role-based access requirements:

### Payment and Fulfillment

- VNPAY payment initiation endpoint:
- Payment return flow:
- Payment status contract:
- Shipping provider:
- Shipping quotation endpoint:
- Shipment creation endpoint:
- Order tracking contract:

### Testing

- Unit testing framework:
- Component testing framework:
- End-to-end testing framework:
- Test directory conventions:
- Required coverage:
- CI workflow:

### Team Workflow

- Team member responsibilities:
- Foundation owners:
- Feature ownership:
- Branch naming convention:
- Pull request template:
- Review and approval policy:
- Release and deployment procedure:

### Deployment

- Hosting platform:
- Build environment:
- Production environment variables:
- Preview deployment strategy:
- Domain and callback URL configuration:
- Monitoring and rollback procedure:

---

## 15. Final Operating Principles

1. Preserve a single, consistent frontend architecture.
2. Finalize and merge shared foundations into `dev` before dependent parallel feature development.
3. Keep the frontend and backend separated through explicit API contracts.
4. Treat external integrations as planned until their implementations are verified.
5. Prefer existing dependencies and conventions over unnecessary additions.
6. Keep secrets out of browser code and version control.
7. Use official documentation for the versions actually installed.
8. Make changes traceable, testable, and easy for other contributors to integrate.
9. Document assumptions instead of silently inventing missing requirements.
10. Prioritize technical correctness and maintainability over premature business-process abstraction.