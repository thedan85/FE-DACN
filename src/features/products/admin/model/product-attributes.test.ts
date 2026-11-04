import { expect, it } from "vitest";

import type { Attribute, AttributeValue, ProductAttributeValue } from "../../types";
import {
	attributeOptions,
	describeProductAttribute,
	linkedAttributeIds,
	resolveAddBlock,
	valueOptions,
} from "./product-attributes";

/**
 * The picker's rules.
 *
 * The important one is not obvious from the DTOs: a product holds **at most one
 * value per attribute**. `productValueId` is `{productId}-{attributeId}`, and
 * the backend rejects a second value for an attribute with a 409 (verified live
 * 2026-11-04: adding a second Temperature value to `anubias-nana-petite`
 * answered 409). A picker that let you choose a second Temperature would fail
 * only after a round trip, so the rule lives here and the UI reflects it.
 */

const temperature: Attribute = {
	attributeId: "temperature",
	name: "Temperature",
	deleted: false,
	createdAt: "",
	updatedAt: "",
};

const color: Attribute = {
	attributeId: "color",
	name: "Color",
	deleted: false,
	createdAt: "",
	updatedAt: "",
};

const temperatureValues: AttributeValue[] = [
	{
		attributeValueId: "temperature-20-28-c",
		attributeId: "temperature",
		attributeName: "Temperature",
		value: "20-28 °C",
		createdAt: "",
		updatedAt: "",
	},
	{
		attributeValueId: "temperature-22-26-c",
		attributeId: "temperature",
		attributeName: "Temperature",
		value: "22-26 °C",
		createdAt: "",
		updatedAt: "",
	},
];

function link(
	attributeId: string,
	attributeValueId: string,
	value: string,
	name: string,
): ProductAttributeValue {
	return {
		productValueId: `PRD_194-${attributeId}`,
		productId: "PRD_194",
		attributeId,
		attributeName: name,
		attributeValueId,
		attributeValue: value,
		createdAt: "",
	};
}

const existing = [link("temperature", "temperature-20-28-c", "20-28 °C", "Temperature")];

it("lists which attributes the product already has a value for", () => {
	expect([...linkedAttributeIds(existing)]).toEqual(["temperature"]);
	expect([...linkedAttributeIds([])]).toEqual([]);
});

it("renders an existing link as the design's readable row", () => {
	expect(describeProductAttribute(existing[0]!)).toBe("Temperature: 20-28 °C");
});

it("marks attributes that already have a value, and disables them", () => {
	// The label carries the state as text, not only as a greyed-out row, so the
	// reason is legible rather than implied by colour.
	const options = attributeOptions([temperature, color], existing);

	expect(options).toEqual([
		{ value: "temperature", label: "Temperature (already set)", disabled: true },
		{ value: "color", label: "Color", disabled: false },
	]);
});

it("leaves every attribute selectable when the product has none", () => {
	const options = attributeOptions([temperature, color], []);

	expect(options.every((option) => !option.disabled)).toBe(true);
	expect(options.map((option) => option.label)).toEqual(["Temperature", "Color"]);
});

it("maps an attribute's values to select options", () => {
	expect(valueOptions(temperatureValues)).toEqual([
		{ value: "temperature-20-28-c", label: "20-28 °C" },
		{ value: "temperature-22-26-c", label: "22-26 °C" },
	]);
});

it("allows adding a value for an attribute the product does not have", () => {
	expect(resolveAddBlock(existing, "color", "color-green")).toBeNull();
});

it("blocks a second value for an attribute, explaining what to do instead", () => {
	// A 409 from the server would be the same information, one round trip later.
	const block = resolveAddBlock(existing, "temperature", "temperature-22-26-c");

	expect(block).toContain("Temperature");
	expect(block).toMatch(/remove/i);
});

it("blocks an exact duplicate even when the attribute looks free", () => {
	// Defence in depth: the attribute check above should already catch this, but
	// a stale list must not turn into a pointless request.
	const block = resolveAddBlock(existing, "temperature", "temperature-20-28-c");

	expect(block).not.toBeNull();
});

it("blocks an incomplete selection", () => {
	expect(resolveAddBlock(existing, null, null)).not.toBeNull();
	expect(resolveAddBlock(existing, "color", null)).not.toBeNull();
	expect(resolveAddBlock(existing, null, "color-green")).not.toBeNull();
});
