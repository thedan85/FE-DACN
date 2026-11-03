# Deleting a product archives it; nothing is hard-deleted

`DELETE /api/v1/products/{productId}` sets `product_status = DELETED` and keeps the row — verified against the live backend, where the deleted product still appeared under `?status=DELETED` and its slug stayed reserved (re-creating the same name produced `…-2`). Withdrawing a product from sale is therefore a **status change, not a deletion**: the admin UI offers *Archive* (`INACTIVE`, reversible) as the ordinary action and treats *Delete* (`DELETED`, terminal in the UI) as the rarer, heavier one.

## Considered Options

- **Hard delete for products with no orders** — impossible: the endpoint has no such branch, and order history must keep resolving its product.
- **Expose `DELETED` in the status dropdown** — rejected: it would let a user "un-delete" by accident and makes the destructive action look reversible in a dropdown.

## Consequences

- The listing needs a *Deleted* status filter for audit, because deleted rows are otherwise unreadable.
- A deleted product's slug is burnt permanently, so re-adding a product under the same name silently gets a `-2` suffix.
- Archive and Delete are two visibly different actions in the UI even though the backend implements both as a status write; collapsing them would hide that only one is reversible.
