"use client";

import { useCallback, useEffect, useState } from "react";
import {
	getGhnProvinces,
	getGhnWards,
	type GhnOption,
} from "../api/shipping.api";

export function useGhnAddress(provinceId: number | null) {
	const [provinces, setProvinces] = useState<GhnOption[]>([]);
	const [wards, setWards] = useState<GhnOption[]>([]);
	const [wardsProvinceId, setWardsProvinceId] = useState<number | null>(null);
	const [loadingProvinces, setLoadingProvinces] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		let active = true;
		getGhnProvinces()
			.then((next) => {
				if (active) {
					setProvinces(next);
					setError(
						next.length === 0
							? "No delivery provinces are available right now."
							: null,
					);
				}
			})
			.catch(() => {
				if (active) setError("Could not load provinces. Please try again.");
			})
			.finally(() => {
				if (active) setLoadingProvinces(false);
			});
		return () => {
			active = false;
		};
	}, [reloadKey]);

	useEffect(() => {
		if (provinceId == null) {
			return;
		}
		let active = true;
		getGhnWards(provinceId)
			.then((next) => {
				if (active) {
					setWards(next);
					setWardsProvinceId(provinceId);
					setError(
						next.length === 0
							? "No wards are available for this province."
							: null,
					);
				}
			})
			.catch(() => {
				if (active) {
					setWards([]);
					setWardsProvinceId(provinceId);
					setError("Could not load wards. Please try again.");
				}
			});
		return () => {
			active = false;
		};
	}, [provinceId, reloadKey]);

	// Wards from an earlier province stay hidden until the new list arrives,
	// so the ward select never offers options for the wrong province.
	const loadingWards = provinceId != null && wardsProvinceId !== provinceId;
	const visibleWards = wardsProvinceId === provinceId ? wards : [];

	const reload = useCallback(() => {
		setLoadingProvinces(true);
		setError(null);
		setReloadKey((key) => key + 1);
	}, []);

	return {
		provinces,
		wards: visibleWards,
		loadingProvinces,
		loadingWards,
		error,
		reload,
	};
}
