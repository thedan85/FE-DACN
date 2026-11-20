"use client";

import { useState } from "react";
import { Button, Drawer, Input, Select } from "antd";
import { FilterOutlined, SearchOutlined } from "@ant-design/icons";

import {
	USER_SORT_OPTIONS,
	type UsersListingQuery,
} from "../model/listing-query";
import { ROLE_FALLBACK_HINT, staffRoleFilterOptions, userRoleFilterOptions } from "../model/roles";
import type { Role } from "../schema/user.schema";
import styles from "./users-toolbar.module.css";

type UsersToolbarProps = {
	query: UsersListingQuery;
	roles: Role[];
	rolesLoading: boolean;
	/** True when the role list is the built-in floor rather than the API's. */
	rolesFallback: boolean;
	/** Staff mode: never offer the customer role; no "All roles" escape. */
	staff?: boolean;
	/** Fires on every committed change; the page owns URL synchronisation. */
	onChange: (next: Partial<UsersListingQuery>) => void;
	/** The keyword is committed on submit rather than per keystroke. */
	onKeywordSubmit: (keyword: string) => void;
};

/**
 * Search, role, and sort controls.
 *
 * The tabs above already choose the status, so this row does not repeat it.
 * The search box is a form: submitting it changes the URL, so a half-typed word
 * never becomes a request. The selects apply immediately, because picking a
 * value is already a commitment.
 *
 * Below `md` the selects move into a drawer and only search stays in the bar,
 * matching the catalog toolbar's mobile behaviour.
 */
export function UsersToolbar({
	query,
	roles,
	rolesLoading,
	rolesFallback,
	staff = false,
	onChange,
	onKeywordSubmit,
}: UsersToolbarProps) {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [keywordDraft, setKeywordDraft] = useState(query.keyword ?? "");
	const [roleCodeDraft, setRoleCodeDraft] = useState("");

	// The URL is the source of truth for the committed keyword, so the box must
	// follow it: "Clear filters", a back button, or a pasted link would otherwise
	// leave stale text in the input and re-apply a filter the URL had dropped.
	// Adjusted during render rather than in an effect, so no stale frame paints.
	const [syncedKeyword, setSyncedKeyword] = useState(query.keyword ?? "");

	if (syncedKeyword !== (query.keyword ?? "")) {
		setSyncedKeyword(query.keyword ?? "");
		setKeywordDraft(query.keyword ?? "");
	}

	const roleOptions = staff
		? staffRoleFilterOptions(roles, query.roleCode)
		: userRoleFilterOptions(roles, query.roleCode);

	const filters = (
		<>
			<Select
				className={styles.select}
				aria-label="Filter by role"
				value={query.roleCode ?? ""}
				options={roleOptions}
				loading={rolesLoading}
				// v6 moved the filter prop onto `showSearch`; passing
				// `optionFilterProp` directly is deprecated.
				showSearch={{ optionFilterProp: "label" }}
				onChange={(value) =>
					onChange({ roleCode: value || undefined, page: 1 })
				}
			/>
			<Select
				className={styles.select}
				aria-label="Sort users"
				value={query.sort}
				options={USER_SORT_OPTIONS.map((option) => ({ ...option }))}
				onChange={(value) => onChange({ sort: value, page: 1 })}
			/>
			{staff && rolesFallback && (
				<form
					className={styles.codeForm}
					onSubmit={(event) => {
						event.preventDefault();
						const code = roleCodeDraft.trim().toLowerCase();
						setRoleCodeDraft("");
						onChange({ roleCode: code || undefined, page: 1 });
					}}
				>
					<Input
						className={styles.codeInput}
						aria-label="Known role code"
						placeholder="Custom role code"
						maxLength={50}
						value={roleCodeDraft}
						onChange={(event) => setRoleCodeDraft(event.target.value)}
					/>
					<Button htmlType="submit">Apply</Button>
				</form>
			)}
		</>
	);

	return (
		<div className={styles.toolbar}>
			<form
				className={styles.searchForm}
				role="search"
				onSubmit={(event) => {
					event.preventDefault();
					onKeywordSubmit(keywordDraft.trim());
				}}
			>
				<Input
					className={styles.search}
					aria-label="Search users by name or email"
					prefix={<SearchOutlined />}
					placeholder="Search by name or email…"
					value={keywordDraft}
					allowClear
					onChange={(event) => {
						setKeywordDraft(event.target.value);
						// Clearing via the built-in control is an explicit reset, so it
						// applies immediately instead of waiting for a submit.
						if (event.target.value === "") {
							onKeywordSubmit("");
						}
					}}
				/>
			</form>

			<div className={styles.desktopFilters}>{filters}</div>

			<Button
				className={styles.mobileFilterButton}
				icon={<FilterOutlined />}
				onClick={() => setDrawerOpen(true)}
			>
				Filters
			</Button>

			{rolesFallback && (
				<span className={styles.fallbackHint} role="status">
					{ROLE_FALLBACK_HINT}
				</span>
			)}

			<Drawer
				title="Filters"
				placement="bottom"
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				size="auto"
			>
				<div className={styles.drawerFilters}>{filters}</div>
			</Drawer>
		</div>
	);
}
