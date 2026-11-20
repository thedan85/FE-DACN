"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
	Alert,
	App,
	Button,
	Card,
	Form,
	Input,
	Modal,
	Popconfirm,
	Select,
	Space,
	Table,
	Tooltip,
	Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
	DeleteOutlined,
	EditOutlined,
	PlusOutlined,
	SearchOutlined,
} from "@ant-design/icons";

import {
	ADMIN_SESSION_REFRESHED_MESSAGE,
	adminAuthFailureFeedback,
	handleAdminAuthFailure,
	recoveredAdminSession,
} from "@/features/auth/admin/model/admin-auth-failure";
import { AccessDeniedState } from "@/components/feedback/access-denied-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import type { Category } from "@/features/products/types";

import {
	createCategory,
	deleteCategory,
	listAdminCategories,
	moveCategoryToRoot,
	patchCategory,
} from "../api/categories.api";
import { apiErrorMessage, isConflict } from "../model/api-error";
import {
	eligibleCategoryParents,
	flattenCategoryHierarchy,
	type FlatCategory,
} from "../model/category-hierarchy";
import { categoryOptions } from "../model/product-form";
import { CATALOG_PERMISSIONS } from "../model/permissions";
import { useCatalogPermissions } from "../use-catalog-permissions";
import { useDialogFocusRestore } from "@/hooks/use-dialog-focus-restore";
import { AdminCatalogTheme } from "./admin-catalog-theme";
import styles from "./categories-view.module.css";

const { Title, Text } = Typography;

/** Sentinel for the "no parent" choice; mapped to `undefined` on submit. */
const ROOT_PARENT_VALUE = "__root__";

type CategoriesState =
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string }
	| { status: "ready"; categories: Category[] };

type FormTarget =
	| { mode: "create" }
	| { mode: "edit"; category: Category };

/**
 * Category management.
 *
 * The whole hierarchy is loaded before anything touches it: every page of
 * `GET /categories` is read and the rows are sorted by name client-side,
 * because the API's page order is not a hierarchy order and a truncated
 * load would let an editor attach a parent from the missing half of the
 * tree.
 *
 * Deletes are blocked client-side for any category that still has a child
 * in the loaded hierarchy. The backend soft-deletes with no child guard,
 * so deleting a known parent would silently orphan its subtree.
 */
export function CategoriesView() {
	const router = useRouter();
	const { can } = useCatalogPermissions();

	const mayCreate = can(CATALOG_PERMISSIONS.categoryCreate);
	const mayUpdate = can(CATALOG_PERMISSIONS.categoryUpdate);
	const mayDelete = can(CATALOG_PERMISSIONS.categoryDelete);

	const [state, setState] = useState<CategoriesState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);
	const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
	const [search, setSearch] = useState("");

	const settled =
		state.status === "ready" ||
		state.status === "error" ||
		state.status === "forbidden";
	const { headingRef, captureTrigger, requestFocusRestore } =
		useDialogFocusRestore({
			settled,
			anyDialogOpen: formTarget !== null,
			settleSignal: state,
		});

	const reload = useCallback(() => setReloadKey((key) => key + 1), []);

	useEffect(() => {
		let active = true;

		listAdminCategories()
			.then((categories) => {
				if (active) {
					setState({ status: "ready", categories });
				}
			})
			.catch(async (caught: unknown) => {
				if (!active) {
					return;
				}

				// Hide protected rows while the session is rechecked; nothing is
				// retried automatically.
				setState({ status: "loading" });
				const outcome = await handleAdminAuthFailure(caught, router);

				if (!active) {
					return;
				}

				const message = apiErrorMessage(
					caught,
					"Could not reach the server. Check your connection and try again.",
				);
				const recovered = recoveredAdminSession(outcome);
				if (outcome === "unhandled" || recovered) {
					// A recovered 401 stays on the page: offer an explicit manual
					// read retry instead of replaying the failed request.
					setState({
						status: "error",
						message: recovered
							? `${ADMIN_SESSION_REFRESHED_MESSAGE} ${message}`
							: message,
					});
					return;
				}

				// Denied read: the helper redirected (401) or refreshed
				// permissions (403); no stale data is left on screen.
				setState({ status: "forbidden" });
			});

		return () => {
			active = false;
		};
	}, [reloadKey, router]);

	const categories = useMemo(
		() => (state.status === "ready" ? state.categories : []),
		[state],
	);
	const flat = useMemo(() => flattenCategoryHierarchy(categories), [categories]);
	const normalizedSearch = search.trim().toLocaleLowerCase();
	// The filter narrows only the displayed rows. The hierarchy, parent
	// choices, cycle handling and child delete guard keep the complete list.
	const visibleFlat = useMemo(() => {
		if (!normalizedSearch) {
			return flat;
		}
		return flat.filter(
			(entry) =>
				entry.category.name.toLocaleLowerCase().includes(normalizedSearch) ||
				entry.category.slug.toLocaleLowerCase().includes(normalizedSearch),
		);
	}, [flat, normalizedSearch]);
	const categoryNameById = useMemo(
		() => new Map(categories.map((category) => [category.categoryId, category.name])),
		[categories],
	);
	const childCountById = useMemo(() => {
		const counts = new Map<string, number>();

		for (const category of categories) {
			if (!category.parentCategoryId) {
				continue;
			}
			counts.set(
				category.parentCategoryId,
				(counts.get(category.parentCategoryId) ?? 0) + 1,
			);
		}

		return counts;
	}, [categories]);

	const columns = useMemo<TableColumnsType<FlatCategory>>(
		() => [
			{
				title: "Name",
				key: "name",
				render: (_, entry) => (
					<span
						className={styles.nameCell}
						style={{ paddingInlineStart: entry.depth * 16 }}
					>
						{entry.category.name}
					</span>
				),
			},
			{
				title: "Slug",
				key: "slug",
				render: (_, entry) => (
					<Text type="secondary">{entry.category.slug}</Text>
				),
			},
			{
				title: "Parent",
				key: "parent",
				width: 180,
				render: (_, entry) => {
					const parentId = entry.category.parentCategoryId;
					const parentName = parentId
						? categoryNameById.get(parentId)
						: undefined;

					return <Text type="secondary">{parentName ?? "—"}</Text>;
				},
			},
			{
				title: "Actions",
				key: "actions",
				width: 120,
				render: (_, entry) => {
					const category = entry.category;
					const hasChildren =
						(childCountById.get(category.categoryId) ?? 0) > 0;

					return (
						<Space size={4}>
							{mayUpdate && (
								<Button
									type="link"
									icon={<EditOutlined />}
									aria-label={`Edit ${category.name}`}
									onClick={(event) => {
										captureTrigger(event);
										setFormTarget({ mode: "edit", category });
									}}
								/>
							)}
							{mayDelete && (
								<DeleteCategoryButton
									category={category}
									blocked={hasChildren}
									onDeleted={reload}
								/>
							)}
						</Space>
					);
				},
			},
		],
		[categoryNameById, childCountById, mayUpdate, mayDelete, reload, captureTrigger],
	);

	return (
		<AdminCatalogTheme>
			<section className={styles.page}>
				<header className={styles.header}>
					<div>
						<Title level={1} className={styles.title} ref={headingRef} tabIndex={-1}>
							Categories
						</Title>
						<Text type="secondary">
							Organise the catalog hierarchy. Changes apply everywhere the catalog reads categories.
						</Text>
					</div>
					{mayCreate && (
						<Button
							type="primary"
							icon={<PlusOutlined />}
							onClick={(event) => {
								captureTrigger(event);
								setFormTarget({ mode: "create" });
							}}
						>
							Add category
						</Button>
					)}
				</header>

				<Card styles={{ body: { padding: 0 } }}>
					{state.status === "ready" && (
						<div className={styles.toolbar}>
							<form
								className={styles.searchForm}
								role="search"
								onSubmit={(event) => event.preventDefault()}
							>
								<Input
									className={styles.search}
									aria-label="Search categories by name or slug"
									prefix={<SearchOutlined />}
									placeholder="Search by name or slug…"
									value={search}
									allowClear
									onChange={(event) => setSearch(event.target.value)}
								/>
							</form>
						</div>
					)}
					{state.status === "forbidden" ? (
						<AccessDeniedState
							title="You do not have access to categories"
							description="Ask an administrator to restore your access to the admin portal."
						/>
					) : state.status === "error" ? (
						<ErrorState
							title="We couldn't load categories"
							description={state.message}
							retryLabel="Try again"
							onRetry={reload}
						/>
					) : state.status === "loading" ? (
						<LoadingState rows={6} label="Loading categories" />
					) : visibleFlat.length === 0 ? (
						normalizedSearch ? (
							<EmptyState
								title="No categories match your search"
								description="Try a different name or slug."
								action={
									<Button onClick={() => setSearch("")}>Clear search</Button>
								}
							/>
						) : (
							<EmptyState
								title="No categories yet"
								description="Create the first category to build the catalog hierarchy."
								action={
									mayCreate ? (
										<Button
											type="primary"
											onClick={(event) => {
												captureTrigger(event);
												setFormTarget({ mode: "create" });
											}}
										>
											Add category
										</Button>
									) : undefined
								}
							/>
						)
					) : (
						<Table<FlatCategory>
							rowKey={(entry) => entry.category.categoryId}
							dataSource={visibleFlat}
							columns={columns}
							pagination={false}
						/>
					)}
				</Card>
			</section>

			{formTarget && (
				<CategoryFormModal
					key={formTarget.mode === "edit" ? formTarget.category.categoryId : "new"}
					initial={formTarget.mode === "edit" ? formTarget.category : null}
					categories={categories}
					onCancel={() => {
						requestFocusRestore();
						setFormTarget(null);
					}}
					onSaved={() => {
						requestFocusRestore();
						setFormTarget(null);
						reload();
					}}
					// A detach can succeed while the follow-up scalar PATCH fails;
					// the table must re-read what actually landed server-side.
					onMutated={reload}
				/>
			)}
		</AdminCatalogTheme>
	);
}

type DeleteCategoryButtonProps = {
	category: Category;
	/**
	 * True when the category still has a child in the loaded hierarchy. The
	 * backend applies no child guard, so this check is the only thing between
	 * a parent and silently orphaned sub-categories.
	 */
	blocked: boolean;
	onDeleted: () => void;
};

function DeleteCategoryButton({
	category,
	blocked,
	onDeleted,
}: DeleteCategoryButtonProps) {
	const router = useRouter();
	const { message } = App.useApp();
	const [deleting, setDeleting] = useState(false);

	const button = (
		<Button
			danger
			type="link"
			icon={<DeleteOutlined />}
			aria-label={`Delete ${category.name}`}
			disabled={blocked || deleting}
			loading={deleting}
		/>
	);

	if (blocked) {
		return (
			<Tooltip title="This category has sub-categories. Move or delete them first.">
				{/* A disabled button emits no pointer events; the wrapper span keeps the tooltip reachable. */}
				<span>{button}</span>
			</Tooltip>
		);
	}

	const confirmDelete = async () => {
		if (deleting) {
			return;
		}

		setDeleting(true);

		try {
			await deleteCategory(category.categoryId);
			message.success(`"${category.name}" deleted.`);
			onDeleted();
		} catch (caught) {
			const outcome = await handleAdminAuthFailure(caught, router);

			if (outcome === "unhandled") {
				message.error(
					apiErrorMessage(caught, `Could not delete "${category.name}".`),
				);
			} else {
				// A 401 that is on its way to login gets no toast; a rehydrated
				// session and a 403 both get actionable copy.
				const feedback = adminAuthFailureFeedback(outcome);
				if (feedback !== null) {
					message.error(feedback);
				}
			}
		} finally {
			setDeleting(false);
		}
	};

	return (
		<Popconfirm
			title={`Delete "${category.name}"?`}
			description="The category is soft-deleted and stops appearing everywhere it is listed. Products attached to this category may lose their category — the portal does not verify product associations. This cannot be undone from the portal."
			okText="Delete category"
			okButtonProps={{ danger: true, disabled: deleting }}
			cancelText="Cancel"
			disabled={deleting}
			onConfirm={() => void confirmDelete()}
		>
			{button}
		</Popconfirm>
	);
}

type CategoryFormValues = {
	name: string;
	slug: string;
	parent: string;
};

type CategoryFormModalProps = {
	/** Null opens the create form; a category opens the edit form for it. */
	initial: Category | null;
	categories: Category[];
	onCancel: () => void;
	onSaved: () => void;
	onMutated: () => void;
};

function textRules(label: string) {
	return [
		{
			required: true,
			whitespace: true,
			message: `${label} is required`,
		},
		{
			max: 255,
			message: `${label} must be 255 characters or fewer`,
		},
	];
}

function CategoryFormModal({
	initial,
	categories,
	onCancel,
	onSaved,
	onMutated,
}: CategoryFormModalProps) {
	const router = useRouter();
	const { message } = App.useApp();
	const [form] = Form.useForm<CategoryFormValues>();
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const parentOptions = useMemo(() => {
		// The edited node is excluded along with everything below it, and any
		// cyclic legacy row is always excluded. The absent id passed for
		// create mode excludes no descendant, so only those rules apply.
		const eligible = eligibleCategoryParents(categories, initial?.categoryId ?? "");

		return [
			{ value: ROOT_PARENT_VALUE, label: "No parent (root)" },
			...categoryOptions(eligible),
		];
	}, [categories, initial]);

	const handleFinish = async (values: CategoryFormValues) => {
		// The submit guard is belt and braces: Enter and Ok both reach here.
		if (saving) {
			return;
		}

		setSaving(true);
		setFormError(null);

		const name = values.name.trim();
		const slug = values.slug.trim();
		const parentId = values.parent === ROOT_PARENT_VALUE ? null : values.parent;
		const currentParentId = initial?.parentCategoryId ?? null;
		// Tracks the one sequence that can partially apply server-side: the
		// detach PUT followed by the scalar PATCH.
		let detached = false;

		try {
			if (!initial) {
				await createCategory({
					name,
					slug,
					...(parentId === null ? {} : { parentCategoryId: parentId }),
				});
			} else {
				const scalarInput: { name?: string; slug?: string } = {};

				if (name !== initial.name) {
					scalarInput.name = name;
				}

				if (slug !== initial.slug) {
					scalarInput.slug = slug;
				}

				const parentChanged = parentId !== currentParentId;

				if (parentChanged && parentId === null) {
					// Renaming alone must use PATCH; detaching to the root is a
					// PUT, so the two are sent separately. Scalar edits go in a
					// PATCH after the detach lands.
					await moveCategoryToRoot(initial.categoryId);
					detached = true;

					if (Object.keys(scalarInput).length > 0) {
						await patchCategory(initial.categoryId, scalarInput);
					}
				} else if (parentChanged && parentId !== null) {
					await patchCategory(initial.categoryId, {
						...scalarInput,
						parentCategoryId: parentId,
					});
				} else if (Object.keys(scalarInput).length > 0) {
					await patchCategory(initial.categoryId, scalarInput);
				}
			}

			message.success(initial ? `"${name}" saved.` : `"${name}" created.`);
			onSaved();
		} catch (caught) {
			await handleAdminAuthFailure(caught, router);

			if (isConflict(caught)) {
				// A duplicate slug belongs on its field: the user fixes one
				// value without losing the rest of the draft.
				form.setFields([{ name: "slug", errors: [caught.message] }]);
			} else {
				setFormError(apiErrorMessage(caught, "Could not save the category."));
			}

			if (detached) {
				onMutated();
			}

			setSaving(false);
		}
	};

	return (
		<Modal
			open
			title={initial ? "Edit category" : "Add category"}
			okText="Save category"
			cancelText="Cancel"
			confirmLoading={saving}
			onOk={() => form.submit()}
			onCancel={() => {
				if (!saving) {
					onCancel();
				}
			}}
			okButtonProps={{ disabled: saving }}
			cancelButtonProps={{ disabled: saving }}
			closable={!saving}
			keyboard={!saving}
			mask={{ closable: false }}
			destroyOnHidden
		>
			{formError && (
				<Alert
					type="error"
					showIcon
					title="Couldn't save the category"
					description={formError}
					className={styles.formError}
				/>
			)}
			<Form<CategoryFormValues>
				form={form}
				layout="vertical"
				requiredMark
				scrollToFirstError={{ focus: true }}
				initialValues={{
					name: initial?.name ?? "",
					slug: initial?.slug ?? "",
					parent: initial?.parentCategoryId ?? ROOT_PARENT_VALUE,
				}}
				onFinish={(values) => void handleFinish(values)}
			>
				<Form.Item name="name" label="Name" rules={textRules("Name")}>
					<Input autoComplete="off" maxLength={255} />
				</Form.Item>
				<Form.Item name="slug" label="Slug" rules={textRules("Slug")}>
					<Input autoComplete="off" maxLength={255} />
				</Form.Item>
				<Form.Item name="parent" label="Parent category">
					<Select
						aria-label="Parent category"
						showSearch={{ optionFilterProp: "label" }}
						options={parentOptions}
					/>
				</Form.Item>
			</Form>
		</Modal>
	);
}
