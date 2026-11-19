/**
 * The admin theme moved to `@/components/layout/admin-theme` so the user
 * screens can share it without importing across a feature boundary. This path
 * stays as a thin re-export for the catalog modules that already import it.
 */
export {
	AdminCatalogTheme,
	AdminTheme,
} from "@/components/layout/admin-theme";
