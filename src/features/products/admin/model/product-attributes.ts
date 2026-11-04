import type {
	Attribute,
	AttributeValue,
	ProductAttributeValue,
} from "../../types";

/**
 * The attribute picker's rules, shared by the product editor and (ticket 07)
 * the variant editor.
 *
 * **A product holds at most one value per attribute.** The backend's
 * `productValueId` is `{productId}-{attributeId}`, and adding a second value for
 * an attribute answers 409 — verified live on 2026-11-04. So the picker must
 * know which attributes are taken before the user spends a round trip finding
 * out, and "change the temperature" means removing the old link first.
 */

/**
 * The shape a link needs for these rules, whether it belongs to a product
 * (`productValueId`) or a variant (`variantValueId`). Structural, so ticket 07's
 * variant links work without a second copy of every function.
 */
export type AttributeLink = Pick<
	ProductAttributeValue,
	"attributeId" | "attributeValueId" | "attributeName" | "attributeValue"
>;

/** The attribute ids that already carry a value. */
export function linkedAttributeIds(
	links: readonly AttributeLink[],
): Set<string> {
	return new Set(links.map((link) => link.attributeId));
}

/** The design's row label for an existing link: `Temperature: 20-28 °C`. */
export function describeProductAttribute(link: AttributeLink): string {
	return `${link.attributeName}: ${link.attributeValue}`;
}

export interface SelectOption {
	value: string;
	label: string;
	disabled: boolean;
}

/**
 * Options for the attribute select.
 *
 * An attribute that already has a value stays visible but disabled, and its
 * label says why: hiding it would leave the user wondering where "Temperature"
 * went, and a disabled row with no reason is a dead end.
 */
export function attributeOptions(
	attributes: readonly Attribute[],
	links: readonly AttributeLink[],
): SelectOption[] {
	const taken = linkedAttributeIds(links);

	return attributes.map((attribute) => {
		const inUse = taken.has(attribute.attributeId);

		return {
			value: attribute.attributeId,
			label: inUse ? `${attribute.name} (already set)` : attribute.name,
			disabled: inUse,
		};
	});
}

/** Options for the value select — one attribute's allowed values. */
export function valueOptions(
	values: readonly AttributeValue[],
): { value: string; label: string }[] {
	return values.map((value) => ({
		value: value.attributeValueId,
		label: value.value,
	}));
}

/**
 * Why an Add would fail, or `null` when it may proceed.
 *
 * Returning the reason (rather than a bare boolean) lets the caller show it and
 * disable the control for the same cause, so the two cannot disagree. The
 * duplicate check is deliberately last: it is the rarer case, and a stale list
 * is the only way to reach it.
 */
export function resolveAddBlock(
	links: readonly AttributeLink[],
	attributeId: string | null | undefined,
	attributeValueId: string | null | undefined,
): string | null {
	if (!attributeId) {
		return "Choose an attribute.";
	}

	if (!attributeValueId) {
		return "Choose a value.";
	}

	const existing = links.find((link) => link.attributeId === attributeId);

	if (existing === undefined) {
		return null;
	}

	if (existing.attributeValueId === attributeValueId) {
		return `${existing.attributeName} is already set to ${existing.attributeValue}.`;
	}

	// One value per attribute: a second one is a 409 on the server.
	return `${existing.attributeName} already has a value (${existing.attributeValue}). Remove it first to change it.`;
}
