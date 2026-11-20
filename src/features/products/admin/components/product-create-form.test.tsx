import { act, cleanup, render } from "@testing-library/react";
import { App } from "antd";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getCategories } from "@/features/products/api/products.api";
import { useAuthStore } from "@/stores/auth-store";

import { listAdminCategories } from "../api/categories.api";
import { ProductCreateForm } from "./product-create-form";

const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: nav.push, replace: vi.fn() }),
}));

vi.mock("@/features/products/api/products.api", () => ({
	getCategories: vi.fn(),
	getProductDetailBySlug: vi.fn(),
}));

vi.mock("../api/categories.api", () => ({
	listAdminCategories: vi.fn(),
}));

const adminUser = {
	userId: "USR_ADMIN",
	email: "admin@example.com",
	name: "Admin Actor",
	phone: "0900000001",
	address: null,
	roleCode: "admin",
	roleName: "Administrator",
	permissions: ["product:create"],
	hasPassword: true,
};

const category = {
	categoryId: "ROOT",
	name: "Reef tanks",
	slug: "reef-tanks",
	parentCategoryId: null,
	deleted: false,
	createdAt: "2026-11-01T00:00:00Z",
	updatedAt: "2026-11-01T00:00:00Z",
};

async function flush() {
	await act(async () => {
		await Promise.resolve();
	});
}

beforeEach(() => {
	nav.push.mockReset();
	useAuthStore.setState({ status: "authenticated", user: adminUser });
	// antd's responsive pieces read these; jsdom provides neither.
	vi.stubGlobal(
		"matchMedia",
		vi.fn().mockReturnValue({
			matches: false,
			addListener() {},
			removeListener() {},
			addEventListener() {},
			removeEventListener() {},
		}),
	);
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	vi.mocked(getCategories).mockReset().mockResolvedValue([category]);
	vi.mocked(listAdminCategories).mockReset().mockResolvedValue([category]);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it("productForm_usesAdminCategoryReader", async () => {
	render(
		<App>
			<ProductCreateForm />
		</App>,
	);
	await flush();

	expect(listAdminCategories).toHaveBeenCalledTimes(1);
	expect(getCategories).not.toHaveBeenCalled();
});
