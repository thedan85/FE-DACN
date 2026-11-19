/**
 * The media library's delete action ships disabled.
 *
 * Deleting a media row removes the image everywhere it renders, including a
 * product's live thumbnail — and listing/detail rendering has not been
 * re-verified since `PUT /products/{id}` started clearing thumbnails. Until
 * Task 9 runs that check, this stays `false`; flipping it is a release
 * decision, not a code change.
 */
export const mediaDeleteEnabled = false;
