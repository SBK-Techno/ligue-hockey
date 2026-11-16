import { z } from 'zod';
import {
	PUSH_ENDPOINT_HOSTS,
	PUSH_ENDPOINT_SUFFIXES
} from '#config/push-delivery.ts';
import { checkboxToBoolean } from '#lib/shared/validation.ts';

const toggle = z.preprocess(
	(value) => (value === undefined ? false : checkboxToBoolean(value)),
	z.boolean()
);

function isAllowedPushEndpoint(value: string): boolean {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:') return false;
		const host = url.hostname.toLowerCase();
		return (
			PUSH_ENDPOINT_HOSTS.includes(host as (typeof PUSH_ENDPOINT_HOSTS)[number]) ||
			PUSH_ENDPOINT_SUFFIXES.some((suffix) => host.endsWith(suffix))
		);
	} catch {
		return false;
	}
}

export const notificationPreferencesSchema = z.object({
	emailEnabled: toggle,
	pushEnabled: toggle
});

export const pushSubscriptionSchema = z.object({
	endpoint: z
		.string()
		.url()
		.max(2048)
		.refine(isAllowedPushEndpoint, 'invalid-push-endpoint'),
	keys: z.object({
		p256dh: z.string().min(1).max(512),
		auth: z.string().min(1).max(512)
	}),
	userAgent: z.string().max(512).optional()
});

export type NotificationPreferencesInput = z.infer<
	typeof notificationPreferencesSchema
>;
