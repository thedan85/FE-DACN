# Aquarium Store

Headless aquarium e-commerce: a customer-facing storefront and a company-facing admin portal, both served by the same Spring Boot API.

## Language

### Accounts and access

**Admin portal**:
The company-facing side of the system, entered through the admin login portal. Serves every role except Customer.
_Avoid_: staff portal, back office, CMS

**Company account**:
An account whose role is not Customer — entitled to the admin portal.
_Avoid_: admin (as a blanket term), internal user, staff account

**Customer**:
An account that shops the storefront. The only role allowed to sign in with Google.
_Avoid_: user, buyer, shopper

**Guest**:
An unauthenticated visitor.
_Avoid_: anonymous user

**Permission**:
A named capability such as `product:update` that an account's role grants. The backend enforces it; the admin UI only reflects it.
_Avoid_: role right, privilege flag

**Catalog manager**:
A company account holding the catalog permissions (`product:*`, `variant:*`, `attribute:*`, `media:*`). Holding `product:create` is what also entitles an account to *see* Draft, Archived and Deleted products.
_Avoid_: admin, editor, catalog owner

### Catalog

**Product**:
A sellable catalog entry with a name, description, category, thumbnail and status. Addressed in URLs by its slug; updated by its `productId`.
_Avoid_: item, article, listing

**Variant**:
The purchasable form of a Product, carrying its own SKU, price and stock. Every price and stock figure in the catalog comes from a Variant, never from the Product itself.
_Avoid_: option, SKU, sub-product

**SKU**:
The stock-keeping code of a Variant, unique across the whole catalog. The backend rejects a duplicate with HTTP 409.
_Avoid_: product code, variant code, item number

**Slug**:
The lowercase, dash-separated public identifier of a Product, used as its URL segment. Auto-derived from the name when not supplied, and reserved forever once used — including by a deleted Product.
_Avoid_: URL handle, permalink

**Thumbnail**:
The one image a Product shows in listings, backed by a Media row that the Product owns.
_Avoid_: cover image, primary image, hero image

**Product status**:
The single state a Product occupies: Draft, Active, Archived or Deleted.
_Avoid_: publish state, visibility

**Draft**:
A Product that is not yet on sale and is invisible to the storefront.
_Avoid_: unpublished, pending, work in progress

**Active**:
A Product that is on sale and visible to the storefront.
_Avoid_: published, live, enabled

**Archived**:
A Product withdrawn from sale but kept for reuse. The backend spells this status `INACTIVE`; it stays visible in the admin listing and returns to Active by changing status.
_Avoid_: inactive, hidden, disabled, unpublished

**Deleted**:
A Product that has been removed. The backend only sets the status — the row is never physically removed — and the Product disappears from every listing except an explicit Deleted filter.
_Avoid_: removed, trashed, hard-deleted

**Attribute**:
A named catalog property (Temperature, Care level, Color) whose acceptable values are a fixed list.
_Avoid_: spec, tag, field, property

**Attribute value**:
One entry from an Attribute's list. A Product or Variant is described by linking to Attribute values, never by free text.
_Avoid_: option value, spec entry

**Care guide**:
The storefront section that renders a Product's Attribute values. It is a presentation of Attributes, not a separate concept or a fixed set of fields.
_Avoid_: care information, specs table
