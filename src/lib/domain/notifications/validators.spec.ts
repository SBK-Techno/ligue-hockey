import { describe, expect, it } from 'vitest';
import { pushSubscriptionSchema } from './validators.ts';

const keys = { p256dh: 'key', auth: 'auth' };

const allowed = [
	'https://fcm.googleapis.com/wp/abc',
	'https://updates.push.services.mozilla.com/wpush/v2/abc',
	'https://web.push.apple.com/abc',
	'https://wns2-par02p.notify.windows.com/w/?token=abc'
];

const rejected = [
	'http://fcm.googleapis.com/wp/abc',
	'https://localhost/push',
	'https://127.0.0.1/push',
	'https://169.254.169.254/latest/meta-data',
	'https://evil.example.com/fcm.googleapis.com',
	'https://notify.windows.com.evil.example/push'
];

describe('push subscription endpoint policy', () => {
	it.each(allowed)('accepts a known push service: %s', (endpoint) => {
		expect(
			pushSubscriptionSchema.safeParse({ endpoint, keys }).success
		).toBe(true);
	});

	it.each(rejected)('rejects an untrusted endpoint: %s', (endpoint) => {
		expect(
			pushSubscriptionSchema.safeParse({ endpoint, keys }).success
		).toBe(false);
	});
});
