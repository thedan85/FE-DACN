# Variants are authored as explicit rows, not generated from options

The design defines variant *option groups* (`Color`, `Size`, `Grade`) and presents the cartesian product as an auto-generated table. The backend has no option model: a Variant is `{sku, price, stock}` plus attribute-value links, created one at a time (`POST /api/v1/variants`). Auto-generation would be client-only state that fans out into N creates, and nothing in the API could reconstruct the option groups on reload. So the editor authors **one row per variant**, each with its own SKU, price, stock and attribute picks.

## Considered Options

- **Option groups with client-side combination generation** — the design's literal model. Rejected for v1: the grouping is unrecoverable from the API (a reload shows rows, not options), partial saves would be ambiguous, and a real product like *Penguin Tetra* (Color: Normal / Red Tail) is expressible as two rows anyway.
- **Generate rows from options as a one-off action** — not rejected outright; it can be layered on later as a *producer of rows*, which is why the data model does not change.

## Consequences

- The option-group card, value chips and `Add option` control from the design are not built; the `Bulk edit →` affordance is deferred too.
- Adding a variant is an explicit user action per row, so a 4-variant product is four deliberate rows rather than one generated set.
- If variant generation is added later, it must write rows through the same API — the editor's model stays row-based.
