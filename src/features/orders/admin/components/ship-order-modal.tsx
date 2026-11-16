"use client";

import { useRef, useState } from "react";
import { Alert, Button, Flex, Form, Input, Modal, Select, Typography } from "antd";

import { getAuthErrorMessage } from "@/features/auth/api/auth.api";
import { useGhnAddress } from "@/features/shipping/hooks/use-ghn-address";
import { ApiError } from "@/lib/api/client";

import { shipStaffOrder, type ShipOrderAddress } from "../api/staff-orders.api";
import type { Order } from "../../types";

function ShipAddressFields({ disabled }: { disabled: boolean }) {
	const form = Form.useFormInstance<ShipOrderAddress>();
	const [provinceId, setProvinceId] = useState<number | null>(null);
	const address = useGhnAddress(provinceId);

	return (
		<>
			{address.error && (
				<Alert
					type="error"
					title={address.error}
					action={<Button onClick={address.reload}>Retry</Button>}
				/>
			)}
			<Form.Item
				name="address"
				label="Street address"
				rules={[{ required: true, whitespace: true, message: "Enter a street address." }]}
			>
				<Input autoComplete="street-address" />
			</Form.Item>
			<Form.Item
				name="province"
				label="Province or city"
				rules={[{ required: true, message: "Select a province or city." }]}
			>
				<Select
					placeholder="Select province or city"
					showSearch={{ optionFilterProp: "label" }}
					loading={address.loadingProvinces}
					disabled={disabled || address.loadingProvinces}
					options={address.provinces.map(({ name }) => ({ value: name, label: name }))}
					onChange={(name: string) => {
						setProvinceId(address.provinces.find((province) => province.name === name)?.id ?? null);
						form.setFieldValue("ward", undefined);
					}}
				/>
			</Form.Item>
			<Form.Item
				name="ward"
				label="Ward or commune"
				rules={[{ required: true, message: "Select a ward or commune." }]}
			>
				<Select
					placeholder={provinceId == null ? "Select a province first" : "Select ward or commune"}
					showSearch={{ optionFilterProp: "label" }}
					loading={address.loadingWards}
					disabled={disabled || provinceId == null || address.loadingWards}
					options={address.wards.map(({ name }) => ({ value: name, label: name }))}
				/>
			</Form.Item>
		</>
	);
}

type ShipOrderModalProps = {
	order: Order;
	onClose: () => void;
	onBooked: (order: Order) => void;
};

export function ShipOrderModal({ order, onClose, onBooked }: ShipOrderModalProps) {
	const [form] = Form.useForm<ShipOrderAddress>();
	const [editingAddress, setEditingAddress] = useState(
		!order.address.trim() || !order.shippingProvince?.trim() || !order.shippingWard?.trim(),
	);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inFlight = useRef(false);

	async function bookShipment(values: ShipOrderAddress) {
		if (inFlight.current) return;
		inFlight.current = true;
		setPending(true);
		setError(null);
		try {
			const booked = await shipStaffOrder(
				order.orderId,
				editingAddress
					? {
							address: values.address.trim(),
							province: values.province.trim(),
							ward: values.ward.trim(),
						}
					: undefined,
			);
			onBooked(booked);
		} catch (caught) {
			setError(
				caught instanceof ApiError && caught.status === 403
					? "You do not have permission to book shipments."
					: getAuthErrorMessage(caught),
			);
		} finally {
			inFlight.current = false;
			setPending(false);
		}
	}

	return (
		<Modal
			open
			title="Book GHN shipment"
			okText="Book shipment"
			onOk={() => form.submit()}
			onCancel={() => { if (!inFlight.current) onClose(); }}
			confirmLoading={pending}
			okButtonProps={{ disabled: pending }}
			cancelButtonProps={{ disabled: pending }}
			closable={!pending}
			keyboard={!pending}
			mask={{ closable: false }}
		>
			<Form<ShipOrderAddress>
				form={form}
				layout="vertical"
				initialValues={{ address: order.address }}
				disabled={pending}
				onFinish={bookShipment}
				onValuesChange={() => setError(null)}
			>
				<Typography.Paragraph strong>Order #{order.orderId}</Typography.Paragraph>
				<Typography.Paragraph>{order.recipientName} · {order.phone}</Typography.Paragraph>
				<Typography.Paragraph>
					{[order.address, order.shippingWard, order.shippingProvince].filter(Boolean).join(", ")}
				</Typography.Paragraph>
				<Typography.Paragraph type="secondary">
					The shop pays shipping. This order remains Confirmed until GHN reports pickup.
				</Typography.Paragraph>
				<Flex vertical gap="small">
					{editingAddress ? (
						<ShipAddressFields disabled={pending} />
					) : (
						<Button onClick={() => setEditingAddress(true)}>Edit delivery address</Button>
					)}
					{error && <Alert type="error" title={error} />}
				</Flex>
			</Form>
		</Modal>
	);
}
