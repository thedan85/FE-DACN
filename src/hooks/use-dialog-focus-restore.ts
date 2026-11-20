"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RefObject, SyntheticEvent } from "react";

/**
 * Focus bookkeeping for admin dialogs whose parents unmount the dialog
 * instead of closing it through rc-dialog's controlled path (which is what
 * returns focus to the trigger). Capture the trigger at the open site; once
 * the dialog detaches, a passive effect decides where focus goes — a
 * synchronous focus while the rc-dialog trap is armed does not work in Edge.
 *
 * `anyDialogOpen` must be true while any owning dialog is open: it keeps the
 * capture owned by the open dialog when the list settles underneath it.
 * `settled`/`settleSignal` describe the backing list: `settled` is true
 * once the read has terminated (ready/error/forbidden), and `settleSignal`
 * changes identity on every settle — pass the state value itself. A boolean
 * alone cannot flip back on reads that never pass through a loading state.
 */

// The element that may hold focus is gone for good: <body>, detached from
// the document, still inside the dialog being removed, or disabled — a
// disabled control cannot hold focus (browsers drop it to <body>). Anything
// else is a control the operator landed on during the close or the reload.
function focusIsGone(active: Element | null): boolean {
	if (
		active === null ||
		active === document.body ||
		!active.isConnected ||
		active.closest('[role="dialog"]') !== null
	) {
		return true;
	}
	return (
		active.getAttribute("aria-disabled") === "true" ||
		(active as HTMLButtonElement).disabled === true
	);
}

// A missing or disabled trigger is not a focus target; the stable heading is.
function triggerUsable(trigger: HTMLElement | null): trigger is HTMLElement {
	if (trigger === null || !trigger.isConnected) {
		return false;
	}
	if (
		trigger.getAttribute("aria-disabled") === "true" ||
		(trigger as HTMLButtonElement).disabled === true
	) {
		return false;
	}
	return true;
}

type UseDialogFocusRestoreOptions = {
	/** True once the backing list read has terminated. */
	settled: boolean;
	/** True while any dialog owned by the view is open. */
	anyDialogOpen: boolean;
	/** Identity changes on every list settle (the state value itself). */
	settleSignal: unknown;
};

export function useDialogFocusRestore({
	settled,
	anyDialogOpen,
	settleSignal,
}: UseDialogFocusRestoreOptions): {
	headingRef: RefObject<HTMLElement | null>;
	captureTrigger: (event: SyntheticEvent<HTMLElement>) => void;
	requestFocusRestore: () => void;
} {
	const headingRef = useRef<HTMLElement | null>(null);
	const triggerRef = useRef<HTMLElement | null>(null);
	const pendingRestoreRef = useRef(false);

	const captureTrigger = useCallback((event: SyntheticEvent<HTMLElement>) => {
		triggerRef.current = event.currentTarget;
	}, []);

	const requestFocusRestore = useCallback(() => {
		pendingRestoreRef.current = true;
	}, []);

	// Passive effect: runs after the commit that detaches the dialog, so the
	// rc-dialog trap has already let go of focus by now.
	const rescueFocusAfterClose = useCallback(() => {
		if (focusIsGone(document.activeElement)) {
			const trigger = triggerRef.current;
			if (triggerUsable(trigger)) {
				trigger.focus({ preventScroll: true });
				return;
			}
			headingRef.current?.focus({ preventScroll: true });
			return;
		}
		// The operator is on another control; don't steal it.
	}, []);

	useEffect(() => {
		if (!pendingRestoreRef.current) {
			return;
		}
		pendingRestoreRef.current = false;
		rescueFocusAfterClose();
	});

	// The close commits before the reload lands. When the reload drops the
	// captured trigger (a deleted row, or an errored list that replaced the
	// table), focus falls back to the stable heading — unless the operator
	// moved to another control in the meantime, in which case it stays there.
	// A settle must not consume the capture while a dialog is open; the open
	// dialog still owns it.
	useEffect(() => {
		if (anyDialogOpen) {
			return;
		}
		if (!settled) {
			return;
		}
		const trigger = triggerRef.current;
		if (trigger === null || trigger.isConnected) {
			// Keep the capture: the row unmounts only when the reload lands,
			// which is this effect's job to notice, not the close commit's.
			return;
		}
		triggerRef.current = null;
		if (focusIsGone(document.activeElement)) {
			headingRef.current?.focus({ preventScroll: true });
		}
	}, [settled, anyDialogOpen, settleSignal]);

	return { headingRef, captureTrigger, requestFocusRestore };
}
