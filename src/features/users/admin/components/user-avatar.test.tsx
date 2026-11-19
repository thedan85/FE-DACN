import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { UserAvatar } from "./user-avatar";

afterEach(cleanup);

it.each([
	{ name: null, email: "missing.profile@example.com", expected: "M" },
	{ name: "", email: "empty.profile@example.com", expected: "E" },
	{ name: " \t ", email: "bob@test.com", expected: "B" },
	{ name: "  Alice User  ", email: "alice@test.com", expected: "AU" },
	{ name: null, email: "", expected: "?" },
	{ name: "", email: "", expected: "?" },
])("renders safe initials for name=$name and email=$email", ({ name, email, expected }) => {
	const { container } = render(<UserAvatar name={name} email={email} />);

	expect(container.textContent).toBe(expected);
});
