"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealGroupProps = {
	children: ReactNode;
	className?: string;
	revealedClassName: string;
};

export function RevealGroup({
	children,
	className,
	revealedClassName,
}: RevealGroupProps) {
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const items =
			rootRef.current?.querySelectorAll<HTMLElement>("[data-reveal]");

		if (!items || items.length === 0) return;

		if (!("IntersectionObserver" in window)) {
			items.forEach((item) => item.classList.add(revealedClassName));
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;

					entry.target.classList.add(revealedClassName);
					observer.unobserve(entry.target);
				}
			},
			{ threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
		);

		items.forEach((item) => observer.observe(item));

		return () => observer.disconnect();
	}, [revealedClassName]);

	return (
		<div className={className} ref={rootRef}>
			{children}
		</div>
	);
}
