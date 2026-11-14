import { z } from "zod";

export const PaymentVietQrSchema = z.object({
	qrUrl: z.string().url(),
	bankId: z.string(),
	accountNo: z.string(),
	accountName: z.string(),
	amount: z.number(),
	addInfo: z.string(),
});

export type PaymentVietQr = z.infer<typeof PaymentVietQrSchema>;
