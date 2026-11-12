"use client";

import { useEffect, useState } from "react";

import type { Attribute } from "../types";
import { listAttributes } from "./api/attributes.api";

/**
 * The twelve catalog attributes, fetched at most once per page.
 *
 * Two surfaces need the same list — the product's attributes card and a
 * variant's attributes dialog — and they used to fetch it independently, so
 * opening the dialog after the card had loaded issued a second identical
 * request. The catalogue changes rarely (twelve rows, seeded), so the result is
 * cached at module scope and shared: one request per page regardless of how many
 * surfaces mount.
 *
 * `enabled` defers the fetch for a surface that is mounted but not yet shown —
 * the variant dialog in particular, which must not cost a request until someone
 * opens it.
 */

export type AttributeCatalogState =
	| { status: "loading" }
	| { status: "ready"; attributes: Attribute[] }
	| { status: "failed" };

/** Survives remounts of the surfaces that read it, for the life of the page. */
let cached: Attribute[] | null = null;
/** De-duplicates concurrent first calls, so two mounts make one request. */
let inFlight: Promise<Attribute[]> | null = null;

function loadAttributes(): Promise<Attribute[]> {
	if (cached !== null) {
		return Promise.resolve(cached);
	}

	if (inFlight === null) {
		inFlight = listAttributes()
			.then((attributes) => {
				cached = attributes;
				return attributes;
			})
			.finally(() => {
				inFlight = null;
			});
	}

	return inFlight;
}

export function useAttributeCatalog(
	enabled = true,
): AttributeCatalogState {
	const [state, setState] = useState<AttributeCatalogState>(() =>
		cached !== null
			? { status: "ready", attributes: cached }
			: { status: "loading" },
	);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		let active = true;

		loadAttributes()
			.then((attributes) => {
				if (active) {
					// A cache hit re-resolves instantly; returning the previous state
					// keeps that from being a pointless re-render.
					setState((previous) =>
						previous.status === "ready" &&
						previous.attributes === attributes
							? previous
							: { status: "ready", attributes },
					);
				}
			})
			.catch(() => {
				if (active) {
					setState({ status: "failed" });
				}
			});

		return () => {
			active = false;
		};
	}, [enabled]);

	return state;
}
