import { z } from 'zod';
import { PAYMENT_METHOD_KEYS } from '#config/payment-methods.ts';
import { DATE_PATTERN } from '#config/time.ts';
import { isRealDate } from '#lib/shared/time/clock.ts';

const optionalDate = z.preprocess(
	(value) => (value === '' || value === undefined ? null : value),
	z
		.string()
		.trim()
		.regex(DATE_PATTERN, 'invalid-date')
		.refine(isRealDate, 'invalid-date')
		.nullable()
);

export const paymentPlanInputSchema = z.object({
	totalCents: z.coerce.number().int().min(0).max(10_000_000),
	firstPercent: z.coerce.number().int().min(1).max(99),
	firstDueDate: optionalDate,
	secondDueDate: optionalDate
});

export const paymentInputSchema = z.object({
	amountCents: z.coerce.number().int().min(1).max(10_000_000),
	paidAt: z
		.string()
		.trim()
		.regex(DATE_PATTERN, 'invalid-date')
		.refine(isRealDate, 'invalid-date'),
	method: z.enum(PAYMENT_METHOD_KEYS),
	note: z.preprocess(
		(value) => (value === '' || value === undefined ? null : value),
		z.string().trim().max(500).nullable()
	)
});

export type PaymentPlanInput = z.infer<typeof paymentPlanInputSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
