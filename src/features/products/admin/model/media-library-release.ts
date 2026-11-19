/**
 * The media library's delete action is released.
 *
 * The release check deleted a current product thumbnail through
 * `DELETE /media/{id}`: the product list and detail stayed readable and the
 * thumbnail cleared to `null`, matching the confirmation copy. The unfiltered
 * admin media list returns 500 (observed live); the cause is not confirmed
 * and is unrelated to deletion. The product-owner filter is the documented
 * workaround until the backend is fixed.
 */
export const mediaDeleteEnabled = true;
