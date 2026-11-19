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

import { getAdminUser, patchCustomerProfile } from "../api/admin-users.api";
import { handleAdminAuthFailure } from "../model/admin-auth-failure";
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
	const snapshotRef = useRef<AdminUserDetail | null>(null);
	const [snapshot, setSnapshot] = useState<AdminUserDetail | null>(null);
	const [readError, setReadError] = useState<string | null>(null);
	const [readForbidden, setReadForbidden] = useState(false);
	const [reading, setReading] = useState(true);
	const [reloadKey, setReloadKey] = useState(0);
	const [submitting, setSubmitting] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [unknownOutcome, setUnknownOutcome] = useState(false);

	useEffect(() => {
		const controller = new AbortController();
		let active = true;
		setReading(true);
		setReadError(null);
		setSaveError(null);

		getAdminUser(userId, controller.signal)
			.then((detail) => {
				if (!active) {
					return;
				}
				snapshotRef.current = detail;
				setSnapshot(detail);
				setReadForbidden(false);
				setUnknownOutcome(false);
				setReading(false);
			})
			.catch(async (caught: unknown) => {
				if (!active || controller.signal.aborted) {
					return;
				}
				const outcome = await handleAdminAuthFailure(caught, router);
				if (!active) {
					return;
				}
				const message = apiErrorMessage(
					caught,
					"Could not load the customer profile.",
				);
				if (outcome === "unauthorized" || outcome === "forbidden") {
					// The session is gone or the permission was revoked: hide the
					// protected payload entirely. The draft is lost with it.
					snapshotRef.current = null;
					setSnapshot(null);
					setReadForbidden(true);
				} else if (snapshotRef.current === null) {
					// First read failed: the dialog shows the failure state instead
					// of a form prefilled with guesses.
					setReadError(message);
				} else {
					// Re-read after an unknown write outcome failed: keep the last
					// snapshot and the draft, say so, and stay blocked.
					setSaveError(message);
				}
				setReading(false);
			});

		return () => {
			active = false;
			controller.abort();
		};
	}, [userId, reloadKey, router]);

	const watched = Form.useWatch(
		(values: CustomerProfileFormValues) => values,
		form,
	);
	const initialValues = snapshot ? toInitialValues(snapshot) : null;
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
		snapshot === null || reading || submitting || unknownOutcome || nothingChanged;

	const submit = async (values: CustomerProfileFormValues) => {
		if (submitting || snapshot === null || reading || unknownOutcome) {
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
			await handleAdminAuthFailure(caught, router);
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
	if (snapshot === null) {
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
				disabled={submitting}
				initialValues={toInitialValues(snapshot)}
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
