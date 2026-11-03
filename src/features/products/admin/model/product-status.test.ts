import { expect, it } from "vitest";

import {
	EDITABLE_PRODUCT_STATUSES,
	FILTERABLE_PRODUCT_STATUSES,
	productStatusLabel,
	productStatusTone,
	toEditableStatus,
} from "./product-status";

/**
 * The design shows three pills (Active / Draft / Archived) while the backend
 * has four statuses. The translations live here so no component invents its
 * own: `INACTIVE` reads *Archived*, and `DELETED` is a status the UI can filter
 * by but never set (ADR-0002).
 */

it("maps every backend status to the label the design uses", () => {
	// Inventing "Inactive" would contradict both the Figma frames and
	// GLOSSARY.md, where the term is Archived.
	expect(productStatusLabel("DRAFT")).toBe("Draft");
	expect(productStatusLabel("ACTIVE")).toBe("Active");
	expect(productStatusLabel("INACTIVE")).toBe("Archived");
	expect(productStatusLabel("DELETED")).toBe("Deleted");
});

it("gives each status a distinct-enough visual tone", () => {
	expect(productStatusTone("ACTIVE")).toBe("success");
	expect(productStatusTone("DRAFT")).toBe("warning");
	expect(productStatusTone("INACTIVE")).toBe("danger");
	expect(productStatusTone("DELETED")).toBe("danger");
});

it("offers only the three assignable statuses for editing", () => {
	// Deleted is the outcome of the delete action, never a dropdown choice:
	// offering it would make an irreversible state look reversible.
	expect(EDITABLE_PRODUCT_STATUSES).toEqual(["DRAFT", "ACTIVE", "INACTIVE"]);
});

it("offers all four statuses as filters", () => {
	// Deleted rows are readable only through this filter, so it has to exist.
	expect(FILTERABLE_PRODUCT_STATUSES).toEqual([
		"DRAFT",
		"ACTIVE",
		"INACTIVE",
		"DELETED",
	]);
});

it("reports whether a status may be assigned", () => {
	expect(toEditableStatus("ACTIVE")).toBe("ACTIVE");
	expect(toEditableStatus("DRAFT")).toBe("DRAFT");
	expect(toEditableStatus("INACTIVE")).toBe("INACTIVE");
	// A product that is already deleted must not be re-editable into Deleted.
	expect(toEditableStatus("DELETED")).toBe("INACTIVE");
});
