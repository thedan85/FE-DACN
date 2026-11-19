"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	Space,
	Table,
	Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
	DeleteOutlined,
	EditOutlined,
	PlusOutlined,
} from "@ant-design/icons";

import {
	adminAuthFailureFeedback,
	handleAdminAuthFailure,
} from "@/features/auth/admin/model/admin-auth-failure";
import { AccessDeniedState } from "@/components/feedback/access-denied-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import type { Attribute, AttributeValue } from "@/features/products/types";

import {
	createAttribute,
	createAttributeValue,
	deleteAttribute,
	deleteAttributeValue,
	listAttributes,
	listAttributeValues,
	patchAttribute,
	patchAttributeValue,
} from "../api/attributes.api";
import { apiErrorMessage, isConflict } from "../model/api-error";
import { CATALOG_PERMISSIONS } from "../model/permissions";
import { useCatalogPermissions } from "../use-catalog-permissions";
import { AdminCatalogTheme } from "./admin-catalog-theme";
import styles from "./attribute-dictionary-view.module.css";

const { Title, Text } = Typography;

type AttributesState =
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string }
	| { status: "ready"; attributes: Attribute[] };

type ValuesState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "forbidden" }
	| { status: "error"; message: string }
	| { status: "ready"; values: AttributeValue[] };

type AttributeFormTarget =
	| { mode: "create" }
	| { mode: "edit"; attribute: Attribute };

type ValueFormTarget =
	| { mode: "create" }
	| { mode: "edit"; value: AttributeValue };

/**
 * Attribute dictionary.
 *
 * One selected attribute and its values, never a global values table: a
 * value's meaning lives in its parent attribute, so the editor works inside
 * the selected attribute's context. Products and variants only ever see the
 * allowed values through this list.
 *
 * The values read is keyed by the selected attribute's id and sequenced by a
 * ref counter, so a response that arrives after the selection changed is
 * discarded instead of replacing the pane the user is looking at. The prior
 * read is not cancelled on the wire — the all-page reader takes no signal —
 * but its result is always dropped.
 */
export function AttributeDictionaryView() {
	const router = useRouter();
	const { can } = useCatalogPermissions();

	const mayCreate = can(CATALOG_PERMISSIONS.attributeCreate);
	const mayUpdate = can(CATALOG_PERMISSIONS.attributeUpdate);
	const mayDelete = can(CATALOG_PERMISSIONS.attributeDelete);

	const [state, setState] = useState<AttributesState>({ status: "loading" });
	const [reloadKey, setReloadKey] = useState(0);
	const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(
		null,
	);
	const [valuesState, setValuesState] = useState<ValuesState>({
		status: "idle",
	});
	const [valuesReloadKey, setValuesReloadKey] = useState(0);
	const [valueActionError, setValueActionError] = useState<string | null>(null);
	const [attributeFormTarget, setAttributeFormTarget] =
		useState<AttributeFormTarget | null>(null);
	const [valueFormTarget, setValueFormTarget] =
		useState<ValueFormTarget | null>(null);

	const reloadAttributes = useCallback(() => setReloadKey((key) => key + 1), []);
	const reloadValues = useCallback(
		() => setValuesReloadKey((key) => key + 1),
		[],
	);

	useEffect(() => {
		let active = true;

		listAttributes()
			.then((attributes) => {
				if (active) {
					setState({ status: "ready", attributes });
				}
			})
			.catch(async (caught: unknown) => {
				if (!active) {
					return;
				}

				const outcome = await handleAdminAuthFailure(caught, router);

				if (!active) {
					return;
				}

				if (outcome === "unhandled") {
					setState({
						status: "error",
						message: apiErrorMessage(
							caught,
							"Could not reach the server. Check your connection and try again.",
						),
					});
					return;
				}

				// Denied read: at this point the helper has refreshed permissions
				// (403) or redirected to sign-in when the session is gone (401).
				setState({ status: "forbidden" });
			});

		return () => {
			active = false;
		};
	}, [reloadKey, router]);

	const attributes = useMemo(
		() => (state.status === "ready" ? state.attributes : []),
		[state],
	);
	// The API's page order carries no meaning; sort by name so rows stay put
	// between reloads.
	const sortedAttributes = useMemo(
		() =>
			[...attributes].sort((left, right) =>
				left.name.localeCompare(right.name),
			),
		[attributes],
	);
	const selectedAttribute =
		attributes.find((attribute) => attribute.attributeId === selectedAttributeId) ??
		null;

	const valuesRequestRef = useRef(0);
	useEffect(() => {
		if (!selectedAttributeId) {
			// Invalidate any in-flight read before swapping the pane to idle.
			valuesRequestRef.current += 1;
			setValuesState({ status: "idle" });
			setValueActionError(null);
			return;
		}

		const requestId = ++valuesRequestRef.current;

		setValuesState({ status: "loading" });
		setValueActionError(null);

		listAttributeValues(selectedAttributeId)
			.then((values) => {
				if (valuesRequestRef.current !== requestId) {
					return;
				}

				setValuesState({ status: "ready", values });
			})
			.catch(async (caught: unknown) => {
				if (valuesRequestRef.current !== requestId) {
					return;
				}

				const outcome = await handleAdminAuthFailure(caught, router);

				if (valuesRequestRef.current !== requestId) {
					return;
				}

				if (outcome === "unhandled") {
					setValuesState({
						status: "error",
						message: apiErrorMessage(
							caught,
							"Could not reach the server. Check your connection and try again.",
						),
					});
					return;
				}

				setValuesState({ status: "forbidden" });
			});
	}, [selectedAttributeId, valuesReloadKey, router]);

	const attributeColumns = useMemo<TableColumnsType<Attribute>>(
		() => [
			{
				title: "Name",
				key: "name",
				render: (_, attribute) => (
					<Button
						type="link"
						className={styles.nameCell}
						aria-pressed={attribute.attributeId === selectedAttributeId}
						onClick={() => setSelectedAttributeId(attribute.attributeId)}
					>
						{attribute.name}
					</Button>
				),
			},
			{
				title: "Actions",
				key: "actions",
				width: 120,
				render: (_, attribute) => (
					<Space size={4}>
						{mayUpdate && (
							<Button
								type="link"
								icon={<EditOutlined />}
								aria-label={`Edit ${attribute.name}`}
								onClick={() =>
									setAttributeFormTarget({ mode: "edit", attribute })
								}
							/>
						)}
						{mayDelete && (
							<DeleteAttributeButton
								attribute={attribute}
								onDeleted={() => {
									// The selected attribute is gone from the catalog, so the
									// values pane must not keep showing its (now orphaned) list.
									setSelectedAttributeId((current) =>
										current === attribute.attributeId ? null : current,
									);
									reloadAttributes();
								}}
							/>
						)}
					</Space>
				),
			},
		],
		[mayUpdate, mayDelete, selectedAttributeId, reloadAttributes],
	);

	const handleValueError = useCallback((reason: string) => {
		setValueActionError(reason);
	}, []);

	const handleValueChanged = useCallback(() => {
		setValueActionError(null);
		reloadValues();
	}, [reloadValues]);

	const valueColumns = useMemo<TableColumnsType<AttributeValue>>(
		() => [
			{
				title: "Value",
				key: "value",
				render: (_, value) => (
					<span className={styles.valueCell}>{value.value}</span>
				),
			},
			{
				title: "Actions",
				key: "actions",
				width: 120,
				render: (_, value) => (
					<Space size={4}>
						{mayUpdate && (
							<Button
								type="link"
								icon={<EditOutlined />}
								aria-label={`Edit value ${value.value}`}
								onClick={() => setValueFormTarget({ mode: "edit", value })}
							/>
						)}
						{mayDelete && (
							<DeleteValueButton
								value={value}
								onDeleted={handleValueChanged}
								onError={handleValueError}
							/>
						)}
					</Space>
				),
			},
		],
		[mayUpdate, mayDelete, handleValueChanged, handleValueError],
	);

	const values = valuesState.status === "ready" ? valuesState.values : [];

	return (
		<AdminCatalogTheme>
			<section className={styles.page}>
				<header className={styles.header}>
					<div>
						<Title level={1} className={styles.title}>
							Attributes
						</Title>
						<Text type="secondary">
							The catalog&apos;s named properties and their allowed values.
							Products and variants link to these values.
						</Text>
					</div>
					{mayCreate && (
						<Button
							type="primary"
							icon={<PlusOutlined />}
							onClick={() => setAttributeFormTarget({ mode: "create" })}
						>
							Add attribute
						</Button>
					)}
				</header>

				<div className={styles.columns}>
					<Card title="Attributes" styles={{ body: { padding: 0 } }}>
						{state.status === "forbidden" ? (
							<AccessDeniedState
								title="You do not have access to attributes"
								description="Ask an administrator to restore your access to the admin portal."
							/>
						) : state.status === "error" ? (
							<ErrorState
								title="We couldn't load attributes"
								description={state.message}
								retryLabel="Try again"
								onRetry={reloadAttributes}
							/>
						) : state.status === "loading" ? (
							<LoadingState rows={6} label="Loading attributes" />
						) : sortedAttributes.length === 0 ? (
							<EmptyState
								title="No attributes yet"
								description="Create the first attribute to start describing the catalog."
								action={
									mayCreate ? (
										<Button
											type="primary"
											onClick={() => setAttributeFormTarget({ mode: "create" })}
										>
											Add attribute
										</Button>
									) : undefined
								}
							/>
						) : (
							<Table<Attribute>
								rowKey={(attribute) => attribute.attributeId}
								dataSource={sortedAttributes}
								columns={attributeColumns}
								rowClassName={(attribute) =>
									attribute.attributeId === selectedAttributeId
										? styles.selectedRow
										: ""
								}
								pagination={false}
							/>
						)}
					</Card>

					<Card
						title={
							selectedAttribute
								? `Values of ${selectedAttribute.name}`
								: "Values"
						}
						extra={
							selectedAttribute && mayCreate ? (
								<Button
									type="primary"
									icon={<PlusOutlined />}
									onClick={() => setValueFormTarget({ mode: "create" })}
								>
									Add value
								</Button>
							) : undefined
						}
						styles={{ body: { padding: 0 } }}
					>
						{!selectedAttribute ? (
							<EmptyState
								title="No attribute selected"
								description="Choose an attribute on the left to see and manage its values."
							/>
						) : valuesState.status === "loading" ||
						  valuesState.status === "idle" ? (
							<LoadingState
								rows={4}
								label={`Loading values of ${selectedAttribute.name}`}
							/>
						) : valuesState.status === "forbidden" ? (
							<AccessDeniedState
								title="You do not have access to these values"
								description="Ask an administrator to restore your access to the admin portal."
							/>
						) : valuesState.status === "error" ? (
							<ErrorState
								title="We couldn't load values"
								description={valuesState.message}
								retryLabel="Try again"
								onRetry={reloadValues}
							/>
						) : (
							<>
								{valueActionError && (
									<Alert
										type="error"
										showIcon
										title="Couldn't delete the value"
										description={valueActionError}
										className={styles.valueAlert}
									/>
								)}
								{values.length === 0 ? (
									<EmptyState
										title="No values yet"
										description={`Add the first allowed value for ${selectedAttribute.name}.`}
										action={
											mayCreate ? (
												<Button
													type="primary"
													onClick={() => setValueFormTarget({ mode: "create" })}
												>
													Add value
												</Button>
											) : undefined
										}
									/>
								) : (
									<Table<AttributeValue>
										rowKey={(value) => value.attributeValueId}
										dataSource={values}
										columns={valueColumns}
										pagination={false}
									/>
								)}
							</>
						)}
					</Card>
				</div>
			</section>

			{attributeFormTarget && (
				<AttributeFormModal
					key={
						attributeFormTarget.mode === "edit"
							? attributeFormTarget.attribute.attributeId
							: "new"
					}
					initial={
						attributeFormTarget.mode === "edit"
							? attributeFormTarget.attribute
							: null
					}
					onCancel={() => setAttributeFormTarget(null)}
					onSaved={() => {
						setAttributeFormTarget(null);
						reloadAttributes();
					}}
				/>
			)}
			{valueFormTarget && selectedAttribute && (
				<ValueFormModal
					key={
						valueFormTarget.mode === "edit"
							? valueFormTarget.value.attributeValueId
							: "new"
					}
					initial={
						valueFormTarget.mode === "edit" ? valueFormTarget.value : null
					}
					attributeId={selectedAttribute.attributeId}
					onCancel={() => setValueFormTarget(null)}
					onSaved={() => {
						setValueFormTarget(null);
						setValueActionError(null);
						reloadValues();
					}}
				/>
			)}
		</AdminCatalogTheme>
	);
}

type DeleteAttributeButtonProps = {
	attribute: Attribute;
	onDeleted: () => void;
};

function DeleteAttributeButton({
	attribute,
	onDeleted,
}: DeleteAttributeButtonProps) {
	const router = useRouter();
	const { message } = App.useApp();
	const [deleting, setDeleting] = useState(false);

	const button = (
		<Button
			danger
			type="link"
			icon={<DeleteOutlined />}
			aria-label={`Delete ${attribute.name}`}
			disabled={deleting}
			loading={deleting}
		/>
	);

	const confirmDelete = async () => {
		if (deleting) {
			return;
		}

		setDeleting(true);

		try {
			await deleteAttribute(attribute.attributeId);
			message.success(`"${attribute.name}" deleted.`);
			onDeleted();
		} catch (caught) {
			const outcome = await handleAdminAuthFailure(caught, router);

			if (outcome === "unhandled") {
				message.error(
					apiErrorMessage(caught, `Could not delete "${attribute.name}".`),
				);
			} else {
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
			title={`Delete "${attribute.name}"?`}
			description="The attribute is soft-deleted and stops appearing in the catalog. This cannot be undone from the portal."
			okText="Delete attribute"
			okButtonProps={{ danger: true, disabled: deleting }}
			cancelText="Cancel"
			disabled={deleting}
			onConfirm={() => void confirmDelete()}
		>
			{button}
		</Popconfirm>
	);
}

type DeleteValueButtonProps = {
	value: AttributeValue;
	onDeleted: () => void;
	/** Surfaced in the pane: a 409 explains detaching first, other errors stay generic. */
	onError: (reason: string) => void;
};

function DeleteValueButton({ value, onDeleted, onError }: DeleteValueButtonProps) {
	const router = useRouter();
	const { message } = App.useApp();
	const [deleting, setDeleting] = useState(false);

	const button = (
		<Button
			danger
			type="link"
			icon={<DeleteOutlined />}
			aria-label={`Delete value ${value.value}`}
			disabled={deleting}
			loading={deleting}
		/>
	);

	const confirmDelete = async () => {
		if (deleting) {
			return;
		}

		setDeleting(true);

		try {
			await deleteAttributeValue(value.attributeValueId);
			message.success(`"${value.value}" deleted.`);
			onDeleted();
		} catch (caught) {
			const outcome = await handleAdminAuthFailure(caught, router);

			if (outcome === "unhandled") {
				if (isConflict(caught)) {
					// The delete is a hard delete against an FK the backend enforces;
					// the row must stay visible and the fix is explained, not retried.
					onError(
						`"${value.value}" is still linked to a product or variant. Detach it from the product or variant first, then delete it.`,
					);
				} else {
					onError(
						apiErrorMessage(
							caught,
							`Could not delete "${value.value}". Please try again.`,
						),
					);
				}
			} else {
				const feedback = adminAuthFailureFeedback(outcome);
				if (feedback !== null) {
					onError(feedback);
				}
			}
		} finally {
			setDeleting(false);
		}
	};

	return (
		<Popconfirm
			title={`Delete value "${value.value}"?`}
			description="The value is deleted for good. Values still linked to a product or variant cannot be deleted."
			okText="Delete value"
			okButtonProps={{ danger: true, disabled: deleting }}
			cancelText="Cancel"
			disabled={deleting}
			onConfirm={() => void confirmDelete()}
		>
			{button}
		</Popconfirm>
	);
}

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

type AttributeFormValues = {
	name: string;
};

type AttributeFormModalProps = {
	/** Null opens the create form; an attribute opens the rename form for it. */
	initial: Attribute | null;
	onCancel: () => void;
	onSaved: () => void;
};

function AttributeFormModal({
	initial,
	onCancel,
	onSaved,
}: AttributeFormModalProps) {
	const router = useRouter();
	const { message } = App.useApp();
	const [form] = Form.useForm<AttributeFormValues>();
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const handleFinish = async (values: AttributeFormValues) => {
		// The submit guard is belt and braces: Enter and Ok both reach here.
		if (saving) {
			return;
		}

		setSaving(true);
		setFormError(null);

		const name = values.name.trim();

		try {
			if (!initial) {
				await createAttribute({ name });
			} else if (name !== initial.name) {
				await patchAttribute(initial.attributeId, { name });
			}

			message.success(initial ? `"${name}" saved.` : `"${name}" created.`);
			onSaved();
		} catch (caught) {
			await handleAdminAuthFailure(caught, router);

			if (isConflict(caught)) {
				// A duplicate name belongs on its field: the user fixes one
				// value without losing the draft.
				form.setFields([{ name: "name", errors: [caught.message] }]);
			} else {
				setFormError(apiErrorMessage(caught, "Could not save the attribute."));
			}

			setSaving(false);
		}
	};

	return (
		<Modal
			open
			title={initial ? "Edit attribute" : "Add attribute"}
			okText="Save attribute"
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
					title="Couldn't save the attribute"
					description={formError}
					className={styles.formError}
				/>
			)}
			<Form<AttributeFormValues>
				form={form}
				layout="vertical"
				requiredMark
				scrollToFirstError={{ focus: true }}
				initialValues={{ name: initial?.name ?? "" }}
				onFinish={(values) => void handleFinish(values)}
			>
				<Form.Item name="name" label="Name" rules={textRules("Name")}>
					<Input autoComplete="off" maxLength={255} />
				</Form.Item>
			</Form>
		</Modal>
	);
}

type ValueFormValues = {
	value: string;
};

type ValueFormModalProps = {
	/** Null opens the create form; a value opens the rename form for it. */
	initial: AttributeValue | null;
	attributeId: string;
	onCancel: () => void;
	onSaved: () => void;
};

function ValueFormModal({
	initial,
	attributeId,
	onCancel,
	onSaved,
}: ValueFormModalProps) {
	const router = useRouter();
	const { message } = App.useApp();
	const [form] = Form.useForm<ValueFormValues>();
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const handleFinish = async (values: ValueFormValues) => {
		if (saving) {
			return;
		}

		setSaving(true);
		setFormError(null);

		const value = values.value.trim();

		try {
			if (!initial) {
				await createAttributeValue({ attributeId, value });
			} else if (value !== initial.value) {
				// The PATCH body carries `{value}` only — the parent is fixed.
				await patchAttributeValue(initial.attributeValueId, { value });
			}

			message.success(initial ? `"${value}" saved.` : `"${value}" created.`);
			onSaved();
		} catch (caught) {
			await handleAdminAuthFailure(caught, router);

			if (isConflict(caught)) {
				form.setFields([{ name: "value", errors: [caught.message] }]);
			} else {
				setFormError(apiErrorMessage(caught, "Could not save the value."));
			}

			setSaving(false);
		}
	};

	return (
		<Modal
			open
			title={initial ? "Edit value" : "Add value"}
			okText="Save value"
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
					title="Couldn't save the value"
					description={formError}
					className={styles.formError}
				/>
			)}
			<Form<ValueFormValues>
				form={form}
				layout="vertical"
				requiredMark
				scrollToFirstError={{ focus: true }}
				initialValues={{ value: initial?.value ?? "" }}
				onFinish={(values) => void handleFinish(values)}
			>
				<Form.Item name="value" label="Value" rules={textRules("Value")}>
					<Input autoComplete="off" maxLength={255} />
				</Form.Item>
			</Form>
		</Modal>
	);
}
