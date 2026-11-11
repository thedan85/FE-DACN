"use client";

import { useCallback, useEffect, useState } from "react";
import {
	getGhnProvinces,
	getGhnWards,
	type GhnOption,
} from "../api/shipping.api";

type WardError = {
	provinceId: number;
	message: string;
};

export function useGhnAddress(provinceId: number | null) {
	const [provinces, setProvinces] = useState<GhnOption[]>([]);
	const [wards, setWards] = useState<GhnOption[]>([]);
	const [wardsProvinceId, setWardsProvinceId] = useState<number | null>(null);
	const [loadingProvinces, setLoadingProvinces] = useState(true);
	const [provinceError, setProvinceError] = useState<string | null>(null);
	const [wardError, setWardError] = useState<WardError | null>(null);
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		let active = true;
		getGhnProvinces()
			.then((next) => {
				if (active) {
					setProvinces(next);
					setProvinceError(
						next.length === 0
							? "No delivery provinces are available right now."
							: null,
					);
				}
			})
			.catch(() => {
				if (active) {
					setProvinceError("Could not load provinces. Please try again.");
				}
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
					setWardError(
						next.length === 0
							? {
									provinceId,
									message: "No wards are available for this province.",
								}
							: null,
					);
				}
			})
			.catch(() => {
				if (active) {
					setWards([]);
					setWardsProvinceId(provinceId);
					setWardError({
						provinceId,
						message: "Could not load wards. Please try again.",
					});
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
	const error =
		provinceError ??
		(wardError?.provinceId === provinceId ? wardError.message : null);

	const reload = useCallback(() => {
		setLoadingProvinces(true);
		setProvinceError(null);
		setWardError(null);
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
