import { expect, it } from "vitest";
import { permissionFixture, roleDetailFixture, roleFixture } from "../test-fixtures";
import { groupPermissions, selectionDiff, adminLockedIds, toggleGroup, effectiveSelection } from "./permission-selection";

const future = { ...permissionFixture, permissionId: "future-id", resource: "z_future", action: "publish", code: "z_future:publish" };
it("groups arbitrary resources in sorted order without an action matrix", () => {
	const groups = groupPermissions([future, permissionFixture, { ...future, permissionId: "other", resource: null }]);
	expect(groups.map((group) => group.resource)).toEqual(["Other", "user", "z_future"]);
	expect(groups[2].permissions[0].permissionId).toBe("future-id");
});
it("diffs ids as sets, ignoring order and duplicates", () => {
	expect(selectionDiff(["a", "b"], ["b", "c", "c"])).toEqual({ added: ["c"], removed: ["a"] });
	expect(selectionDiff(["a", "b"], ["b", "a"])).toEqual({ added: [], removed: [] });
});
it("locks every future user/role action for admin by resource, not id spelling", () => {
	const rolePermission = { ...future, permissionId: "unrelated-id", resource: "role", code: "role:future" };
	expect([...adminLockedIds(roleFixture, [permissionFixture, rolePermission, future])]).toEqual(["PERM_user-read", "unrelated-id"]);
	expect([...adminLockedIds(roleDetailFixture, [permissionFixture])]).toEqual([]);
	expect(effectiveSelection([], new Set(["unrelated-id"]))).toEqual(["unrelated-id"]);
});
it("group clear retains locked ids and select all restores every group member", () => {
	expect(toggleGroup(["a", "b", "elsewhere"], ["a", "b"], new Set(["a"]))).toEqual(["a", "elsewhere"]);
	expect(toggleGroup(["a"], ["a", "b"], new Set(["a"]))).toEqual(["a", "b"]);
});
