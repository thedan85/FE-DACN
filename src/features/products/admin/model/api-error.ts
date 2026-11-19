/**
 * The shared API error helpers moved to `@/lib/api/api-error` so features other
 * than the catalog can use them without crossing a feature boundary. This path
 * stays as a thin re-export for the catalog modules that already import it.
 */
export { apiErrorMessage, isConflict } from "@/lib/api/api-error";
