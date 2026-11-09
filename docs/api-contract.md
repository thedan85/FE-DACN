# Backend API contract

What the frontend is actually allowed to assume about the Spring Boot API at
`http://localhost:8080`, as opposed to what the OpenAPI document implies. Kept
because every fact here was learned the expensive way — by writing code against
the wrong assumption, then debugging it — and because none of them are visible
in a DTO signature.

**Verified:** 2026-11-04 against the backend source in the read-only sibling
checkout and the running API. Re-verified where a fact could have moved
(`maxPageSize`, the login windows, the `Product` entity's restriction).

**Precedence:** the backend source and a live response beat this document, and
this document beats the frontend code. When they disagree, fix this file in the
same commit that fixes the code — a contract that drifts is worse than no
contract, because it is quoted with confidence.

**How each row was established:**

| Mark | Meaning |
|---|---|
| **[live]** | observed in a response from the running API |
| **[source]** | read in the controller, service, or entity |
| **[both]** | read in the source and confirmed against the live API |

**Re-verifying** after a backend change:

```powershell
curl.exe -s http://localhost:8080/v3/api-docs | Out-File -Encoding utf8 "$env:TEMP\api-docs.json"
```

then read the relevant controller under `src/main/java` in the backend checkout.
The quirks below are the parts `api-docs` will not tell you: it describes the
shapes, not the behaviour.

---

## Envelope and errors

Before the shapes: **the API on `localhost:8080` is local, the stores behind it are not.** PostgreSQL is a Supabase pooler in ap-southeast-2 and Redis is hosted, both shared with the whole team. That changes how this contract has to be used:

- **A `DELETE` is permanent.** `DELETE /products/{id}` sets `status = DELETED` and the row survives with its slug still reserved. A throwaway probe product is still there tomorrow, and still holding its slug. Creating such products is fine **in an agent session** (the coursework database is re-seeded before submission), but never from CI/CD — see `docs/verification.md` § Never put live end-to-end tests in CI.
- **The rate limits are team-wide.** The limiter runs in the shared Redis, so the login window is spent by everyone's sessions combined. A `429` is a stop sign: wait it out, never retry around it.
- **Reads are slow.** A cold `GET /products` measured 5.5 s and a warm one ~830 ms over the cross-region hop, so a "fetch everything, then filter" loop is far more expensive than it looks and the `size` clamp caps it anyway.

Details and measurements: `docs/verification.md` § The database and Redis are hosted.

| Fact | Behaviour |
|---|---|
| Success shape | `ApiResponse {code, message, data}` — the payload is under `data`, never at the top. **[both]** |
| `429` | An ordinary `ApiResponse` with `code: 429`, `data: null`, so `apiFetch` surfaces it as `ApiError(429)`. **[both]** |
| `403` | **Empty body** on a permission failure, so there is no `message` to show. `apiFetch` falls back to a status-only message. **[both]** |
| `409` duplicate slug | Carries `slug already exists: …` in `message`. **[both]** |
| `409` duplicate SKU | Carries a message naming the SKU. **[both]** |

## Auth and rate limiting

Login is limited per IP **and** per account, and the per-account window is long
enough to strand a development session.

| Key | Limit | Mark |
|---|---|---|
| `rl:login:<ip>` | 10 per **1 minute** per source IP | **[source]** |
| `rl:login-email:<email>` | 10 per **15 minutes** per account, regardless of IP ("so many source IPs cannot brute-force one email") | **[source]**, diagnosed while chasing repeated 429s **[live]** |
| `rl:refresh:<ip>` | 30 per minute | **[source]** |
| `rl:google:<ip>` | 20 per minute | **[source]** |
| `rl:register:<ip>` | 20 per **hour** | **[source]** |
| `rl:pwd:<user>` | 5 per minute | **[source]** |
| Redis down | The limiter **fails open** and logs a warning; requests proceed | **[source]** |

The practical consequence, learned repeatedly: a verification run must **reuse
one session** rather than re-authenticating per check. Recovering from the
per-email limit needs a ~15-minute wait, not a retry — and a token taken from a
429 body is not a token, so the next call reports 401 and sends you looking in
the wrong place.

The limiter state lives in the **shared hosted Redis**, so these windows are
team-wide: your retries spend a budget everyone else needs. A `429` means stop
and wait, never retry in a loop. Do not add a live login to CI for the same
reason (`docs/verification.md` § Never put live end-to-end tests in CI).

`GET /auth/me` returns the account's `permissions[]` and its `roleCode`
**lowercase** (`"customer"`, not `"CUSTOMER"`) — a strict comparison against the
uppercase spelling lets a customer through.

## Pagination

| Fact | Behaviour | Mark |
|---|---|---|
| Defaults | `page=0`, `size=20` when omitted | **[source]** `WebConfig.pageableCustomizer` |
| `size` cap | `maxPageSize=100`. A larger value is **silently clamped to 100**, not rejected: `size=200` returns 100 rows and looks successful | **[both]** |
| Page indices | 0-based on the wire; the UI's 1-based page must be converted (`toApiPage`) | **[source]** |

## Reading products

| Fact | Behaviour | Mark |
|---|---|---|
| `GET /products` params | `keyword`, `category_id`, `min_price`, `max_price`, `status`, `sort`, `page`, `size` → `PageResponse<ProductResponse>` | **[both]** |
| Default status | **`status` omitted means `ACTIVE`, not "all".** `visibleStatus` pins callers without `VIEW_HIDDEN_PRODUCTS` to `ACTIVE` | **[both]** |
| No "all statuses" | `status` is a single enum (`DRAFT\|ACTIVE\|INACTIVE\|DELETED`); lowercase is a `400` | **[both]** |
| Privileged visibility | `VIEW_HIDDEN_PRODUCTS` is an alias of `product:create`. Admin and Employee hold it; Customer does not | **[both]** |
| `keyword` | Case-insensitive `LIKE` on **name only** — not SKU, not description | **[both]** |
| `category_id` | Expands to the whole descendant subtree server-side | **[both]** |
| `sort` | `newest` \| `price_asc` \| `price_desc` only. A Spring-style `sort=field,dir` is **actively discarded**, so it neither sorts nor errors | **[both]** |
| `GET /products/{slug}` | **By slug only** — a `productId` 404s. Returns `{product, attributes[], variants[], reviews}` | **[both]** |
| Non-`ACTIVE` by slug | Staff holding `product:create` can read `DRAFT`/`INACTIVE`; an anonymous caller gets `404` | **[both]** |
| `DELETED` by slug | 404s **for everyone**: `Product` carries `@SQLRestriction("product_status <> 'DELETED'")`, so the row is invisible except through `?status=DELETED`, which uses a native query that bypasses the restriction | **[both]** |
| Price and stock | Derived, never stored: `minPrice`/`maxPrice` from non-deleted variants, `stock` their sum. No variants → `null`, `null`, `0` | **[both]** |
| Caching | Catalog reads are cached; **stock is overlaid fresh on every cache hit** while price may lag the TTL | **[source]** |

## Writing products — the PATCH / PUT asymmetry

The single most dangerous part of this contract. `PATCH` merges, `PUT` replaces,
and they differ on exactly the two nullable fields.

| Field | `PATCH /products/{id}` (`update`) | `PUT /products/{id}` (`replace`) |
|---|---|---|
| `categoryId: null` | **"Not provided" — the existing category stays.** A silent no-op. **[both]** | **Detaches the product from its category.** **[both]** |
| `thumbnailMediaId`, omitted **or** `null` | Keeps the current thumbnail (`!= null` guard). **[source]** | **Clears the thumbnail.** **[both]** |
| Other fields | Merge: null means "leave alone". **[source]** | Merge for scalars too (columns are `NOT NULL`, so a true wipe is impossible). **[source]** |

Consequences the UI must respect:

- **Detaching a category requires `PUT`**, and a `PATCH` with `categoryId: null`
  looks like it worked while changing nothing. `buildProductRequest` returns the
  method alongside the body for this reason.
- **A detach by `PUT` must carry `thumbnailMediaId`**, or it silently deletes the
  product's image. Verified: a `PUT` that omitted it returned `thumbnail: null`.
- Both methods take the **`productId`**, never the slug. **[both]**
- A slug change applies through either method; a duplicate is `409`, and a blank
  slug means "leave it alone" (`applySlugChange` returns early). **[both]**
- `ProductUpdateRequest` has no `NULL`-able required column, so "replace" is a
  merge in practice — the two methods differ **only** in the two rows above.

## Create

| Fact | Behaviour | Mark |
|---|---|---|
| Required fields | `name` (`@NotBlank`, ≤255) and `description` (`@NotBlank`); whitespace-only fails both | **[both]** |
| Status | **`POST` persists the requested `status`** — one request is enough. An omitted status defaults to `ACTIVE` | **[both]** |
| Response | The created `ProductResponse`, including the server-derived `slug` and `productId` | **[both]** |

`POST` previously forced `ACTIVE` regardless of the request body; that was a
backend bug, fixed upstream on 2026-11-04. Create-then-`PATCH` was the
workaround and is gone — do not reintroduce it.

## Deleting

| Fact | Behaviour | Mark |
|---|---|---|
| `DELETE /products/{id}` | Sets `status = DELETED`; the row is never removed | **[both]** |
| Slug stays reserved | Re-creating the same name yields `…-2`, because the unique index covers deleted rows | **[both]** |
| Reachability | Readable only via `?status=DELETED`; invisible by slug | **[both]** |

See ADR-0002 — deletion is archival, by design.

## Slugs

| Fact | Behaviour | Mark |
|---|---|---|
| Pattern | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤255 characters, `search` reserved | **[source]** |
| Normalisation order | `strip()` then **`toLowerCase()`** then the pattern check — so `Blue-Dream` is **accepted** and stored as `blue-dream`. A client validator that rejects mixed case is stricter than the API | **[both]** |
| Auto-derivation | From the name when blank: NFD-normalise, drop marks, map `đ`→`d`, collapse to dashes; `-2`, `-3` on collision; `unnamed` if nothing survives | **[both]** |
| Duplicate | `409` carrying `slug already exists: …` | **[both]** |

## Variants

| Fact | Behaviour | Mark |
|---|---|---|
| Shape | `{variantId, sku, price, stock, productId, productName, deleted, createdAt, updatedAt}`. **`stock` is a nullable `Integer`** | **[both]** |
| `stock` nullability | `null` means **"not reported"**, and the service scrubs it on cached rows. Reading it as `0` writes an invented stock level and zeroes the product total with no error | **[both]** |
| Create | `POST /variants {productId, sku, price, stock}`; `price ≥ 0`, `stock ≥ 0` | **[both]** |
| SKU | **Globally unique**; a duplicate is `409` | **[both]** |
| `PUT` vs `PATCH` | **Identical** — `replace` is literally `return update(...)`. No asymmetry here, unlike products | **[source]** |
| Delete | `deleted = true` (soft); the row survives and stops counting toward the product's price range and stock | **[both]** |
| No option model | A variant is SKU + price + stock + attribute links. Nothing stores option groups, so they cannot be reconstructed on reload | **[source]**, ADR-0003 |

## Attributes

| Fact | Behaviour | Mark |
|---|---|---|
| Catalog | `GET /attributes` → 12 rows; `GET /attributes/{id}/values` → that attribute's values (68 across all). Both paginated | **[both]** |
| **One value per attribute** | A product holds at most one value per attribute, and a variant likewise. Enforced by `unique(product_id, attribute_id)` and `unique(variant_id, attribute_id)`; a second value is `409` | **[both]** |
| Link id is predictable | `productValueId = {productId}-{attributeId}`, `variantValueId = {variantId}-{attributeId}` — which is *why* the uniqueness rule holds | **[both]** |
| Add / remove | `POST /product-attributes {productId, attributeId, attributeValueId}` returns the link; `DELETE /product-attributes/{productValueId}`. Variants mirror it on `/variant-attributes` | **[both]** |
| Gating differs | `/product-attributes` is gated on `attribute:create`/`attribute:delete`; **`/variant-attributes` is gated on `variant:create`/`variant:delete`** | **[source]** |
| No update | A link can only be added or removed — "change Temperature" means remove then add | **[source]** |
| Categories | `GET /categories` → 115 rows, `parentCategoryId` nullable (4 roots) | **[both]** |

## Media

| Fact | Behaviour | Mark |
|---|---|---|
| Thumbnail upload | `POST /uploads/products/{id}/thumbnail`, multipart field **`file`**, JPEG/PNG/WebP/GIF, ≤10 MB, content-type **and** magic-byte checked. Returns `{url, folder, productId, variantId, mediaId}` and **sets the product's thumbnail in the same request** | **[both]** |
| Variant image upload | `POST /uploads/variants/{id}`, same rules, creates variant-scoped `Media` | **[both]** |
| Rejections | A non-image is `400 unsupported image type: …`; wrong extension and a magic-byte mismatch are also `400` | **[both]** |
| Media delete | Soft: `deleted = true` | **[source]** |
| **No gallery upload** | Nothing uploads bytes into a gallery — `POST /media` accepts only an already-hosted `url`. A multi-image gallery is not implementable; only the thumbnail is | **[source]** |
| Removing a thumbnail | Only through `PUT /products/{id}` **omitting** `thumbnailMediaId` (see the asymmetry table) | **[both]** |
| Gating | Uploading needs `media:create`; **removing needs `product:update`**, because it is a `PUT` on the product. The two gates are separate | **[both]** |
| Refreshing after a write | An image write changes no product field. Rewriting form inputs from the returned product reverts what the user typed and clears the dirty state — silently. Merge only the thumbnail fields | **[both]** |

## Permissions

| Fact | Behaviour | Mark |
|---|---|---|
| Codes | `product:create/update/delete`, `variant:*`, `category:*`, `attribute:*`, `attribute-value:*`, `media:*`, `order:read/update/complete`, exposed by `GET /auth/me` as `permissions[]` | **[both]** |
| Enforced twice | `@PreAuthorize` on the controller method **and** URL rules in `SecurityConfig` | **[source]** |
| Admin vs Employee | Both seeded accounts hold identical catalog rights; Admin's only extra is `order:complete`, so a catalog difference between them is **not observable** | **[both]** |
| `403` shape | Empty body (not an `ApiResponse`), so the UI reports a status-only message | **[both]** |

## antd naming that reads like a backend fact

Not the API's business, but recorded here because it cost the same debugging
cycle: antd v6 deprecates `List` in favour of `Listy` (`items` + `itemRender`),
renames `Alert.message` to `title`, and deprecates `Select.optionFilterProp`.
`npm run lint:antd` catches all three; `tsc` catches none.

## What this document used to get wrong

Kept because each entry cost a debugging cycle, and because a future reader
deserves to know which parts were written from assumption.

| # | Believed | Actually | Found in |
|---|---|---|---|
| 1 | `POST /products` persists the `status` it is sent | The mapper forced `ACTIVE` on insert. **Fixed upstream** in `618e8b9`; the create-then-`PATCH` workaround was removed in `8cc9a66` | Ticket 01 probe; re-verified after the fix |
| 2 | `PATCH` and `PUT` differ only in strictness | They differ on exactly two fields: `PATCH` treats `categoryId: null` as "not provided" and keeps the thumbnail; `PUT` **detaches** the category and **clears** an omitted thumbnail | Ticket 05 review, then proven live |
| 3 | A product may hold several values per attribute | **One value per attribute**, enforced by a unique index; a second value is `409` | Ticket 06 — live 409, confirmed in the entity |
| 4 | A `DELETED` product is readable by staff via its slug | It 404s for everyone: `@SQLRestriction("product_status <> 'DELETED'")` hides the row | Ticket 05 — the edit screen showed "not found" |
| 5 | `size` can be raised to fetch everything | Clamped to 100 (`maxPageSize`); `size=200` returns 100 rows and looks fine | Ticket 06 — read `WebConfig` |
| 6 | Auth has no throttling worth planning around | Login is 10/min **per IP** and 10/**15 min per account**; fails open if Redis is down | Tickets 04–06 — repeated 429s |
| 7 | A client slug validator should reject mixed case | The backend lowercases *before* matching, so `Blue-Dream` is accepted | Ticket 02 review |
| 8 | A variant's `stock` is non-null, like the detail embed's | `VariantResponse.stock` is a **nullable `Integer`**; reading it as `0` invents a stock level | Ticket 07 — review, then mutation-checked |
| 9 | Variant attribute links are gated like product ones | `/variant-attributes` is gated on `variant:create`/`variant:delete` | Ticket 07 — read the controller |
| 10 | The media card could be gated on `media:create` alone | Removing a thumbnail is a `PUT` on the product, so it also needs `product:update` | Ticket 08 — review, then verified in the browser |
| 11 | One scoped theme gives every control the admin focus ring | `Input` and `Select` ignore `colorPrimaryBorder` and build their ring from component tokens resolved against the *global* theme — measured `#1BC5BD33`, effectively invisible. Three tokens needed, not one | Ticket 09 — measured in the browser |
