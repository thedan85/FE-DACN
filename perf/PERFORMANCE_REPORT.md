# Storefront API performance baseline & fixes

Scope: Spring Boot backend (`DACN`) read APIs consumed by the Next.js storefront,
measured with `postman performance run` (local runner) and a representative,
**read-only** collection (`storefront-reads.postman_collection.json`).

The backend was run locally against the project's existing remote Supabase
(PostgreSQL, ap-southeast-2) and Redis (Upstash). No write traffic was sent.

## Test setup

| | |
|---|---|
| Target | `http://localhost:8080/api/v1` (Spring Boot 4.1.1, Java 21) |
| Runner | Postman CLI local |
| Load profile | `fixed` (sustained), 60 s |
| VUs | 10 (baseline) and 20 (breaking-point probe) |
| Collection | 10 public GETs: product list, search, detail, variants, media, attributes, categories, variant list, media list, Redis health |
| Threshold | `p95 < 1000 ms` (10 VU), `p95 < 1500 ms` (20 VU) |

## Results — before fixes

**Aggregate (`fixed`, 10 VU, 60 s):**

| Metric | Value |
|---|---|
| Requests | 1,146 |
| Throughput | 18.5 rps |
| avg / p90 / p95 / p99 / max | 509 / 893 / 976 / 2,154 / 3,935 ms |
| Errors | 0% |

**Aggregate (`fixed`, 20 VU, 60 s):** 1,263 requests, 20.1 rps,
avg 933 / p95 1,649 / p99 3,074 ms, 0% errors — **threshold failed**.
Doubling VUs raised throughput only ~8%: the run was latency-bound, not
CPU-bound. Each VU spent roughly a second waiting on remote I/O.

**Per-endpoint (4 concurrent clients, 16 requests each, warm):**

| Endpoint | p50 | p95 | Notes |
|---|---|---|---|
| `health/redis` | 66 ms | 77 ms | single Redis Round trip |
| `categories` | 92 ms | 146 ms | fully cached, no DB hit |
| `attributes` | 451 ms | 671 ms | **no cache** → DB |
| `attribute-values` | 893 ms | 1,129 ms | **no cache** → 2 DB queries |
| `media` | 902 ms | 1,339 ms | **no cache** → DB |
| `variants` | 512 ms | 741 ms | cached, but DB stock overlay |
| `products?size=20` | 516 ms | 768 ms | cached, but DB stock overlay |
| `products/search?name=…` | 508 ms | 757 ms | cached, but DB stock overlay |
| `products/{slug}` | 499 ms | 719 ms | cached, but DB stock overlay |
| `products/{slug}/variants` | 513 ms | 731 ms | cached, but DB stock overlay |

## Critical issues found

1. **Uncached reference-data lists** — `/attributes`, `/attribute-values`,
   `/media` issued one or two remote DB round trips on every request
   (up to 1.3 s p95), despite writes already invalidating a cache generation.
2. **Stock overlay re-queried the database on every cache hit** — all cached
   product/variant endpoints paid an extra ~220 ms RTT (often more under
   concurrency) to re-read stock, so a "cache hit" still cost ~500 ms.
3. **`GET /health/redis` returned 500 with a full stack trace** when the remote
   Redis was briefly unreachable during startup (observed in the log). The
   rest of the app fails open; the health endpoint did not.
4. **First request after startup ~3 s**; the backend takes ~50–120 s to boot
   because Flyway validates 36 migrations and Hibernate builds the EMF against
   the remote database. Not a per-request problem, but relevant to cold starts
   and autoscaling.
5. **Remote PostgreSQL/Redis dominate latency** — the app is in Vietnam, the DB
   is in Sydney and Redis is a separate hosted service. No amount of local
   tuning removes that RTT; cache design must avoid per-request remote calls.

## Fixes applied

Backend source (`DACN`):

- `CatalogCacheKeys` — added cache keys and a 5-minute TTL for attribute,
  attribute-value and media lists. They share `PRODUCT_SCOPE`, which every
  writer of that data already bumps after commit, so invalidation stays correct.
- `AttributeService`, `AttributeValueService`, `MediaService` — public list
  reads now use the existing generation-based Redis cache. Non-standard pages
  and staff-only media reads (`includeHidden`) still go straight to the DB.
- `ProductService` and `VariantService` — replaced the per-request DB stock
  overlay with a short-lived (2 s) process-local snapshot. Concurrent reads of
  the same product/variant now share one DB query; staleness is bounded to 2 s
  and checkout still re-checks stock with a conditional `UPDATE`, so no oversell.
- `HealthController` — Redis failures are reported as `"redis":"DOWN"` instead
  of an unhandled 500/stack trace.

Verification: `./mvnw test` — **766 tests, 0 failures** (run after each change).

## Results — after fixes

Same collection, same local runner, same target, after rebuilding the jar.

**Aggregate comparison:**

| | Before | After | Change |
|---|---|---|---|
| 10 VU: requests / rps | 1,146 / 18.5 | 2,135 / 33.9 | +86% throughput |
| 10 VU: avg / p90 / p95 / p99 / max | 509 / 893 / 976 / 2,154 / 3,935 ms | 255 / 516 / 544 / 749 / 893 ms | ~2–4x faster |
| 20 VU: requests / rps | 1,263 / 20.1 | 2,490 / 39.5 | +97% throughput |
| 20 VU: avg / p95 / p99 | 933 / 1,649 / 3,074 ms | 429 / 863 / 1,219 ms | ~2x faster |
| 20 VU threshold `p95 < 1000` | **FAILED** | **PASSED** (863 ms) | — |
| Errors | 0% | 0% | — |

**Per-endpoint p50 (4 clients, 16 requests each, warm):**

| Endpoint | Before | After |
|---|---|---|
| `attributes` | 451 ms | 87 ms |
| `attribute-values` | 893 ms | 76 ms |
| `media` | 902 ms | 71 ms |
| `products?size=20` | 516 ms | 87 ms |
| `products/search?name=…` | 508 ms | 72 ms |
| `products/{slug}` | 499 ms | 59 ms |
| `products/{slug}/variants` | 513 ms | 82 ms |
| `variants` | 512 ms | 75 ms |
| `category subtree filter` | 504 ms | 87 ms |
| `categories` (control) | 92 ms | 110 ms |
| `health/redis` (control) | 66 ms | 53 ms |

Reproduce with:

```bash
cd fe-dacn
postman performance run perf/storefront-reads.postman_collection.json \
  --runner local --load-profile fixed --peak-vu 20 -d 1 \
  --output ndjson --pass-if "less_than(p95, 1000)"
```

## Remaining known limitations / recommendations

- The 2 s stock snapshot (ProductService and VariantService) trades visible
  freshness for latency. If stricter freshness is required, bump the cache
  generation from checkout/restock and serve stock from the cached payload
  with no overlay at all.
- At 10 VU the stricter `p95 < 500 ms` goal is not met (544 ms); the tail is
  dominated by the two remaining Redis round trips (generation lookup + cache
  read) on every cached request. Merging those into one Redis call is the next
  optimization if sub-500 ms p95 matters.
- `GET /products/{productId}/media` and `/attributes` use the product **ID**,
  not the slug — probing them with a slug correctly returns 404 (seen in the
  per-endpoint table). Not a defect; noted so the numbers are not misread.
- `/attributes/{id}`, `/attribute-values/{id}`, `/media/{id}` single-item reads
  are still uncached; lower traffic, so left alone.
- The local runner competes with the app for CPU on one machine. For a true
  capacity number use `postman-cloud` after confirming the target is reachable
  from it. Thresholds are evaluated after the run — they do not stop traffic.
- 20 VU did not saturate the target; the generator was latency-bound. Higher VU
  would be needed to find the real ceiling, which would put more load on the
  shared Supabase instance.
