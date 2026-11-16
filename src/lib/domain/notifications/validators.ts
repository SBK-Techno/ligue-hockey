import { z } from 'zod';
import { checkboxToBoolean } from '#lib/shared/validation.ts';

const toggle = z.preprocess(
	(value) => (value === undefined ? false : checkboxToBoolean(value)),
	z.boolean()
);

export const notificationPreferencesSchema = z.object({
	emailEnabled: toggle,
	pushEnabled: toggle
});

export const pushSubscriptionSchema = z.object({
	endpoint: z.string().url().max(2048),
	keys: z.object({
		p256dh: z.string().min(1).max(512),
		auth: z.string().min(1).max(512)
	}),
	userAgent: z.string().max(512).optional()
});

export type NotificationPreferencesInput = z.infer<
	typeof notificationPreferencesSchema
>;
