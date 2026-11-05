# Renewal, reconciliation, and provider lifecycle

Status: open

Implement Task 19 from the approved backend plan. Extend the existing manager rather than adding a second connection or global state architecture.

## Acceptance criteria

- Fresh credentials precede each socket/reconnect; renewal occurs before signed expiry.
- Reconnect backoff and shared join scheduling prevent hot retry loops.
- One visible-tab periodic/focus reconciliation schedule serves live and REST-only resources, with coalesced dirty follow-up.
- Logout/account switching removes private socket state and discards stale in-flight responses.
- Provider renders no UI and does not wrap/restyle existing children.
- `npx.cmd vitest run src/features/realtime`, `npm.cmd run check`, and `npm.cmd run build` pass.
- Browser verification uses the existing project workflow; unavailable hosted authorization remains explicitly unverified.
