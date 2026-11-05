# Realtime foundation

Status: approved

Implement the browser portion of the approved event-foundation module without redesigning any page. Requirements are defined in the backend workspace at `docs/superpowers/specs/2026-11-03-event-foundation-design.md` and implementation plan `docs/superpowers/plans/2026-11-04-event-foundation.md`, Tasks 17–19.

The Spring API remains authoritative for authentication and business data. The official Supabase SDK receives admitted private Broadcast invalidations only. No Supabase Auth persistence, business-table reads, browser publishing, signing keys, or second polling loop.

Backend credentials contract: `POST /api/v1/realtime/credentials`, request `{ productIds: string[] }`, response inside `ApiResponse`: `{ accessToken, expiresAt, admittedProductIds, inboxTopic }`. Guests receive no inbox. Disabled/unavailable returns 503. Malformed or expired supplied Spring bearer never becomes a guest.

Local tests must cover limits, renewal, backoff, reconciliation, stale responses, and account cleanup. Hosted authorization, Data API lockdown, signing-key import, and Free-plan usage verification remain operator-only gates. Installing the SDK is not permission to enable hosted traffic.
