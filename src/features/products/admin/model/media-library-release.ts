/**
 * The media library's delete action is released.
 *
 * The release check deleted a current product thumbnail through
 * `DELETE /media/{id}`: the product list and detail stayed readable and the
 * thumbnail cleared to `null`, matching the confirmation copy. A backend data
 * defect still breaks the unfiltered admin media list (one row fails to
 * serialize), but that is unrelated to deletion.
 */
export const mediaDeleteEnabled = true;
