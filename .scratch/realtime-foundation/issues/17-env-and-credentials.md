# Public configuration and credentials API

Status: in-progress

Implement Task 17 from the approved backend plan. Preserve the existing frontend dependencies except for the official Supabase SDK. Read frontend instructions and installed Next.js/SDK documentation before editing.

## Acceptance criteria

- Optional Supabase public URL/key validate as both-or-neither; non-loopback URLs require HTTPS.
- The centralized Spring API client sends the existing in-memory bearer header and validates the credential envelope with Zod.
- Missing configuration disables Realtime; 503 never produces a fabricated token or hidden retry loop.
- `npm.cmd run test -- --run src/lib/env.test.ts src/features/realtime/api/realtime.api.test.ts` passes.
- `npm.cmd run check` passes, with any pre-existing failure identified separately.
- Lockfile changes come from npm; no secrets or unrelated upgrades.

## Comments

2026-11-05: Corrected the missing Realtime env getter, both-or-neither validation, and exact-loopback URL handling. Preserved existing SDK/dependency versions, lockfile, schema/API implementation, and Task18/19 files. Added regressions and centralized HTTP-boundary cases without removing existing assertions.

Supplemental local checks passed 34/34, with red evidence before the production correction. The required Vitest command cannot collect tests because the existing Rolldown native binding is missing. `npm.cmd run check` still reports four baseline provider/manager/lifecycle test-type errors. Status remains in-progress; no completion or hosted behavior is claimed.

Full evidence and dependency inspection: `D:\Coding\DoAnJava\DACN\.superpowers\sdd\2026-11-04-event-foundation\task-17-report.md`.
