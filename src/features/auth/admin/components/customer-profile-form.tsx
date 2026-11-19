"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
	Alert,
	Button,
	Form,
	Input,
	Modal,
} from "antd";

import { AccessDeniedState } from "@/components/feedback/access-denied-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { ApiError } from "@/lib/api/client";
import { apiErrorMessage } from "@/features/products/admin/model/api-error";
import { useAuthStore } from "@/stores/auth-store";

import { getAdminUser, patchCustomerProfile } from "../api/admin-users.api";
import {
	ADMIN_SESSION_REFRESHED_MESSAGE,
	handleAdminAuthFailure,
	recoveredAdminSession,
} from "../model/admin-auth-failure";
import type {
	AdminUserDetail,
	CustomerProfilePatch,
} from "../schema/admin-users.schema";

const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;
const NAME_MAX = 255;
const ADDRESS_MAX = 255;

interface CustomerProfileFormValues {
	name: string;
	phone: string;
	address: string;
}

function toInitialValues(
	detail: AdminUserDetail,
): CustomerProfileFormValues {
	return {
		name: detail.name,
		phone: detail.phone ?? "",
		address: detail.address ?? "",
	};
}

/**
 * Diffs the trimmed draft against the fetched snapshot and emits only the
 * changed fields. A blanked address clears it via `address: null`; a blanked
 * phone is never sent (validation rejects clearing a phone that is set, and
 * an already-null phone compares equal to blank).
 */
function diffCustomerProfilePatch(
	values: CustomerProfileFormValues,
	snapshot: AdminUserDetail,
): CustomerProfilePatch {
	const patch: CustomerProfilePatch = {};

	const name = values.name.trim();
	if (name !== snapshot.name) {
		patch.name = name;
	}

	const phone = values.phone.trim();
	if (phone !== (snapshot.phone ?? "") && phone !== "") {
		patch.phone = phone;
	}

	const address = values.address.trim();
	const snapshotAddress = snapshot.address ?? "";
	if (address !== snapshotAddress) {
		patch.address = address === "" ? null : address;
	}

	return patch;
}

/**
 * Reapplies the fields the admin actually edited onto a freshly fetched
 * detail. Fields left untouched take the fresh value, so a concurrent change
 * made while the write was in flight is never replaced by a stale draft. A
 * cleared address is represented by `null` in the patch and by `""` in the
 * field.
 */
function applyPatchToValues(
	detail: AdminUserDetail,
	patch: CustomerProfilePatch,
): CustomerProfileFormValues {
	return {
		name: patch.name ?? detail.name,
		phone: patch.phone ?? detail.phone ?? "",
		address: patch.address === undefined ? detail.address ?? "" : patch.address ?? "",
	};
}

/** A failed write whose effect on the server is unknown: transport failure or a 5xx. */
function isUnknownWriteOutcome(caught: unknown): boolean {
	return (
		!(caught instanceof ApiError) ||
		caught.status === 0 ||
		caught.status >= 500
	);
}

/**
 * Edit dialog for a customer's name, phone and address, backed by
 * `PATCH /admin/users/{userId}/profile`. The draft is prefilled from a fresh
 * detail read — never from the list row — and Save stays disabled until at
 * least one trimmed field actually differs. Rejected writes keep the draft;
 * a write with an unknown outcome blocks Save until the profile is re-read.
 */
export function CustomerProfileForm({
	userId,
	onClose,
	onSaved,
}: {
	userId: string;
	onClose: () => void;
	onSaved: () => void;
}) {
	const router = useRouter();
	const [form] = Form.useForm<CustomerProfileFormValues>();
	const permissions = useAuthStore((state) => state.user?.permissions);
	const mayRead = permissions?.includes("user:read") === true;
	const mayUpdate = permissions?.includes("user:update") === true;
	const baseRef = useRef<AdminUserDetail | null>(null);
	/** Intended edits, kept only across a recoverable auth failure. */
	const intendedRef = useRef<CustomerProfilePatch | null>(null);
	const [snapshot, setSnapshot] = useState<AdminUserDetail | null>(null);
	/** Explicit seed for the Form; a remount cannot reuse stale antd store values. */
	const [formSeed, setFormSeed] = useState<CustomerProfileFormValues | null>(null);
	const [readError, setReadError] = useState<string | null>(null);
	const [readForbidden, setReadForbidden] = useState(false);
	const [reading, setReading] = useState(true);
	const [reloadKey, setReloadKey] = useState(0);
	const [submitting, setSubmitting] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [unknownOutcome, setUnknownOutcome] = useState(false);
	const [writeRevalidating, setWriteRevalidating] = useState(false);

	useEffect(() => {
		if (!mayRead) {
			// Reading authority is gone: forget the base and any draft so a
			// later regrant starts from a fresh detail read, not old fields.
			baseRef.current = null;
			intendedRef.current = null;
			setSnapshot(null);
			setFormSeed(null);
			setReading(false);
			setReadForbidden(false);
			setUnknownOutcome(false);
			setSaveError(null);
			return;
		}
		const controller = new AbortController();
		let active = true;
		setReading(true);
		setReadError(null);
		setSaveError(null);

		// A re-read keeps only the fields the admin edited. Capture that patch
		// before any failure can unmount the Form and lose the live draft.
		const base = baseRef.current;
		if (base !== null && intendedRef.current === null) {
			intendedRef.current = diffCustomerProfilePatch(
				form.getFieldsValue(),
				base,
			);
		}

		getAdminUser(userId, controller.signal)
			.then((detail) => {
				if (!active) {
					return;
				}
				const intended = intendedRef.current;
				// Fresh detail is the base; only intended fields are overlaid.
				const seed =
					intended === null
						? toInitialValues(detail)
						: applyPatchToValues(detail, intended);
				intendedRef.current = null;
				baseRef.current = detail;
				setSnapshot(detail);
				setFormSeed(seed);
				setReadForbidden(false);
				setUnknownOutcome(false);
				setReading(false);
			})
			.catch(async (caught: unknown) => {
				if (!active || controller.signal.aborted) {
					return;
				}
				// Hide protected fields before revalidation resolves. A pending
				// 401/403 check must never leave the old draft on screen.
				setSnapshot(null);
				setReading(true);
				baseRef.current = null;

				const outcome = await handleAdminAuthFailure(caught, router);
				if (!active) {
					return;
				}
				const message = apiErrorMessage(
					caught,
					"Could not load the customer profile.",
				);
				setReadForbidden(false);
				if (recoveredAdminSession(outcome)) {
					// Keep the intended patch for the manual read retry. No
					// rejected write is replayed here.
					setReadError(`${ADMIN_SESSION_REFRESHED_MESSAGE} ${message}`);
				} else if (outcome === "unauthorized" || outcome === "forbidden") {
					// Genuine denial: the draft is dropped with the payload.
					intendedRef.current = null;
					setReadForbidden(true);
					setReadError(message);
				} else {
					// Transport or server failure: retryable. Keep the intended
					// patch so the manual read can rebase it onto fresh detail.
					setReadForbidden(false);
					setReadError(message);
				}
				setReading(false);
			});

		return () => {
			active = false;
			controller.abort();
		};
	}, [userId, reloadKey, router, mayRead, form]);

	// antd keeps its field store across a Form unmount, so a new `initialValues`
	// alone cannot replace an old draft. Write the freshly fetched (and, after
	// recovery, rebased) values once the Form for this snapshot is mounted.
	useEffect(() => {
		if (snapshot !== null && formSeed !== null) {
			form.setFieldsValue(formSeed);
		}
	}, [snapshot, formSeed, form]);

	const watched = Form.useWatch(
		(values: CustomerProfileFormValues) => values,
		form,
	);
	const initialValues =
		formSeed ?? (snapshot ? toInitialValues(snapshot) : null);
	const effectiveValues: CustomerProfileFormValues = {
		name: watched?.name ?? initialValues?.name ?? "",
		phone: watched?.phone ?? initialValues?.phone ?? "",
		address: watched?.address ?? initialValues?.address ?? "",
	};
	const patch = snapshot
		? diffCustomerProfilePatch(effectiveValues, snapshot)
		: {};
	const nothingChanged = Object.keys(patch).length === 0;
	const saveDisabled =
		!mayRead ||
		!mayUpdate ||
		snapshot === null ||
		reading ||
		submitting ||
		unknownOutcome ||
		nothingChanged;

	const submit = async (values: CustomerProfileFormValues) => {
		if (
			!mayRead ||
			!mayUpdate ||
			submitting ||
			snapshot === null ||
			reading ||
			unknownOutcome
		) {
			return;
		}
		const nextPatch = diffCustomerProfilePatch(values, snapshot);
		if (Object.keys(nextPatch).length === 0) {
			return;
		}

		setSubmitting(true);
		setSaveError(null);

		try {
			await patchCustomerProfile(userId, nextPatch);
			// The parent closes the dialog and reloads; do not touch state here.
			onSaved();
		} catch (caught) {
			// Hide protected fields while the session/permission check runs.
			// The snapshot and draft stay in state, so recovery can restore a
			// manual retry or read-only access without replaying the write.
			const authRejected =
				caught instanceof ApiError &&
				(caught.status === 401 || caught.status === 403);
			if (authRejected) {
				setWriteRevalidating(true);
			}
			await handleAdminAuthFailure(caught, router);
			setWriteRevalidating(false);
			if (isUnknownWriteOutcome(caught)) {
				setUnknownOutcome(true);
			} else {
				setSaveError(
					apiErrorMessage(
						caught,
						"Could not save the customer profile. Please try again.",
					),
				);
			}
			setSubmitting(false);
		}
	};

	let body;
	if (writeRevalidating) {
		body = <LoadingState rows={3} label="Checking your access" />;
	} else if (!mayRead) {
		body = (
			<AccessDeniedState
				title="You do not have access to this customer"
				description="Ask an administrator for the user:read permission."
			/>
		);
	} else if (snapshot === null) {
		if (readForbidden) {
			body = (
				<AccessDeniedState
					title="You do not have access to this customer"
					description="Ask an administrator for the user:read permission."
				/>
			);
		} else if (readError) {
			body = (
				<ErrorState
					title="We couldn't load the customer profile"
					description={readError}
					retryLabel="Try again"
					onRetry={() => setReloadKey((key) => key + 1)}
				/>
			);
		} else {
			body = <LoadingState rows={3} label="Loading customer profile" />;
		}
	} else {
		body = (
			<Form<CustomerProfileFormValues>
				form={form}
				layout="vertical"
				disabled={submitting || reading || !mayUpdate}
				initialValues={initialValues ?? undefined}
				onFinish={(values) => void submit(values)}
			>
				<Form.Item
					name="name"
					label="Name"
					rules={[
						{ required: true, whitespace: true, message: "Enter a name." },
						{
							validator: (_, value?: string) =>
								(value ?? "").trim().length <= NAME_MAX
									? Promise.resolve()
									: Promise.reject(
											new Error(
												`Name must be at most ${NAME_MAX} characters.`,
											),
										),
						},
					]}
				>
					<Input autoComplete="off" />
				</Form.Item>
				<Form.Item
					name="phone"
					label="Phone"
					extra="10–15 digits, optionally starting with +."
					rules={[
						{
							validator: (_, value?: string) => {
								const trimmed = (value ?? "").trim();
								if (trimmed === "") {
									return snapshot.phone
										? Promise.reject(
												new Error(
													"A phone number that is already set cannot be cleared.",
												),
											)
										: Promise.resolve();
								}

								return PHONE_PATTERN.test(trimmed)
									? Promise.resolve()
									: Promise.reject(
											new Error(
												"Phone must be 10–15 digits, optionally starting with +.",
											),
										);
							},
						},
					]}
				>
					<Input autoComplete="off" />
				</Form.Item>
				<Form.Item
					name="address"
					label="Address"
					extra="Blank clears the stored address."
					rules={[
						{
							validator: (_, value?: string) =>
								(value ?? "").trim().length <= ADDRESS_MAX
									? Promise.resolve()
									: Promise.reject(
											new Error(
												`Address must be at most ${ADDRESS_MAX} characters.`,
											),
										),
						},
					]}
				>
					<Input autoComplete="off" />
				</Form.Item>
				{unknownOutcome && (
					<Alert
						type="warning"
						showIcon
						style={{ marginBottom: 16 }}
						title="The result of the last save is unknown."
						description="The server may have applied the change. Reload the profile before saving again."
						action={
							<Button
								size="small"
								loading={reading}
								onClick={() => setReloadKey((key) => key + 1)}
							>
								Reload profile
							</Button>
						}
					/>
				)}
				{saveError && (
					<Alert type="error" showIcon title={saveError} />
				)}
			</Form>
		);
	}

	return (
		<Modal
			open
			title="Edit customer profile"
			okText="Save changes"
			confirmLoading={submitting}
			onOk={() => form.submit()}
			onCancel={() => {
				if (!submitting) {
					onClose();
				}
			}}
			okButtonProps={{ disabled: saveDisabled }}
			cancelButtonProps={{ disabled: submitting }}
			closable={!submitting}
			keyboard={!submitting}
			mask={{ closable: false }}
		>
			{body}
		</Modal>
	);
}
