import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { AccessDeniedState } from "./access-denied-state";

afterEach(cleanup);

it("renders the shared no-permission state with its default copy", () => {
	render(<AccessDeniedState />);

	expect(screen.getByText("You do not have permission to view this page")).toBeTruthy();
	expect(
		screen.getByText(/administrator/i),
	).toBeTruthy();
});
