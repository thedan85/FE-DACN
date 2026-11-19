import { useState } from "react";

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { App, Typography } from "antd";
import { afterEach, expect, it } from "vitest";

import { useDialogFocusRestore } from "./use-dialog-focus-restore";

afterEach(() => {
	cleanup();
});

const { Title } = Typography;

type HarnessProps = {
	settled?: boolean;
	/** New identity each time the backing list settles; state itself works. */
	settleSignal?: unknown;
	/** The list dropped the row that owns the trigger. */
	rowDetached?: boolean;
	/** The trigger stays disabled once it was used to open a dialog. */
	disableRowAfterOpen?: boolean;
};

function Harness({
	settled = true,
	settleSignal = 0,
	rowDetached = false,
	disableRowAfterOpen = false,
}: HarnessProps) {
	const [open, setOpen] = useState(false);
	const [wasOpened, setWasOpened] = useState(false);
	const { headingRef, captureTrigger, requestFocusRestore } =
		useDialogFocusRestore({ settled, anyDialogOpen: open, settleSignal });

	return (
		<App>
			<Title ref={headingRef} tabIndex={-1} level={1}>
				Page heading
			</Title>
			<button
				type="button"
				onClick={(event) => {
					captureTrigger(event);
					setOpen(true);
				}}
			>
				Add thing
			</button>
			{!rowDetached && (
				<button
					type="button"
					disabled={disableRowAfterOpen && wasOpened}
					onClick={(event) => {
						captureTrigger(event);
						setOpen(true);
						setWasOpened(true);
					}}
				>
					Edit thing
				</button>
			)}
			<button type="button">Elsewhere</button>
			{open && (
				<div role="dialog" aria-label="Thing dialog">
					<input aria-label="Inside dialog" />
					<button
						type="button"
						onClick={() => {
							requestFocusRestore();
							setOpen(false);
						}}
					>
						Close dialog
					</button>
				</div>
			)}
		</App>
	);
}

it("restores focus to the captured trigger after the dialog closes", async () => {
	render(<Harness />);

	const trigger = screen.getByRole("button", { name: "Edit thing" });
	trigger.focus();
	fireEvent.click(trigger);

	screen.getByLabelText("Inside dialog").focus();
	fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

	await waitFor(() => {
		expect(document.activeElement).toBe(trigger);
	});
});

it("falls back to the heading when a settle detaches the captured trigger", async () => {
	const view = render(<Harness />);

	const trigger = screen.getByRole("button", { name: "Edit thing" });
	trigger.focus();
	fireEvent.click(trigger);
	fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

	await waitFor(() => {
		expect(document.activeElement).toBe(trigger);
	});

	// The reload drops the row (e.g. it vanished) and lands: the captured
	// trigger is detached for good.
	view.rerender(<Harness rowDetached settleSignal={1} />);

	expect(document.activeElement).toBe(
		screen.getByRole("heading", { name: "Page heading" }),
	);
});

it("falls back to the heading when the captured trigger is disabled", async () => {
	render(<Harness disableRowAfterOpen />);

	const trigger = screen.getByRole("button", { name: "Edit thing" });
	trigger.focus();
	fireEvent.click(trigger);

	// The trigger stays disabled once used (e.g. "Save permission changes"
	// after a clean save); closing must not strand focus on it.
	screen.getByLabelText("Inside dialog").focus();
	fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

	await waitFor(() => {
		expect(document.activeElement).toBe(
			screen.getByRole("heading", { name: "Page heading" }),
		);
	});
});

it("does not steal focus when the operator moved to another control", async () => {
	render(<Harness />);

	const trigger = screen.getByRole("button", { name: "Add thing" });
	trigger.focus();
	fireEvent.click(trigger);

	const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
	elsewhere.focus();
	fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

	await waitFor(() => {
		expect(document.activeElement).toBe(elsewhere);
	});
});

it("keeps the capture when the list settles while the dialog is open", async () => {
	const view = render(<Harness settleSignal={0} />);

	const trigger = screen.getByRole("button", { name: "Edit thing" });
	trigger.focus();
	fireEvent.click(trigger);

	// A list read settles mid-dialog; it must not consume the capture the
	// open dialog still owns.
	view.rerender(<Harness settleSignal={1} />);

	fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));

	await waitFor(() => {
		expect(document.activeElement).toBe(trigger);
	});
});
