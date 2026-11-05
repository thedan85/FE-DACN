# Connection manager core

Status: open

Implement Task 18 from the approved backend plan. Depend on Task 17's validated configuration and credentials API. Export the approved singleton and subscription/reconciliation contracts.

## Acceptance criteria

- No client/socket without admitted topics; at most one client per tab and one socket per fresh credential lease.
- Stock interests and inbox subscription use reference counts and admitted scopes only.
- All joins share one two-per-second scheduler; no persisted Supabase Auth.
- Stale account responses cannot join channels or update listeners after stop/account change.
- `npx.cmd vitest run src/features/realtime/join-scheduler.test.ts src/features/realtime/connection-manager.test.ts` passes.
- Independent review verifies no token logging, broad topic joining, or duplicate polling loop.
