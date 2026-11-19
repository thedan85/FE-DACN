"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App } from "antd";

/** Covers reload/close and ordinary link navigation; App Router has no general back blocker. */
export function useUnsavedRoleChanges(dirty: boolean) {
	const router = useRouter();
	const { modal } = App.useApp();
	useEffect(() => {
		if (!dirty) return;
		let leaving = false;
		let prompt: ReturnType<typeof modal.confirm> | undefined;
		const beforeUnload = (event: BeforeUnloadEvent) => {
			if (!leaving) { event.preventDefault(); event.returnValue = ""; }
		};
		const followLink = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
			const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
			if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.href === window.location.href) return;
			const destination = new URL(anchor.href);
			if (!/^https?:$/.test(destination.protocol)) return;
			event.preventDefault();
			event.stopPropagation();
			if (prompt) return;
			prompt = modal.confirm({
				title: "Discard unsaved changes?", content: "Your role changes have not been saved.",
				okText: "Discard changes", cancelText: "Keep editing",
				onCancel: () => { prompt = undefined; },
				onOk: () => {
					leaving = true;
					if (destination.origin === window.location.origin) router.push(`${destination.pathname}${destination.search}${destination.hash}`);
					else window.location.assign(destination.href);
				},
			});
		};
		window.addEventListener("beforeunload", beforeUnload);
		document.addEventListener("click", followLink, true);
		return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", followLink, true); prompt?.destroy(); };
	}, [dirty, router, modal]);
}
