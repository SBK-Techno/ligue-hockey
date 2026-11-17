import { PUSH_DELIVERY } from '#config/push.ts';
import {
	deletePushSubscription,
	listPushSubscriptionsForUser
} from '#lib/domain/notifications/queries.ts';
import type { PushSubscriptionRow } from '#lib/domain/notifications/schema.ts';
import type { RenderedNotification } from '#lib/domain/notifications/templates.ts';
import { env } from '#lib/shared/config/env.ts';
import { logger } from '#lib/shared/logging/logger.ts';

type WebPush = typeof import('web-push');

export type PushDeliveryResult = {
	delivered: number;
	failed: number;
	/** La dernière erreur d'abonnement, conservée pour le travail en échec. */
	lastError: unknown;
};

let configured: WebPush | null = null;

async function client(): Promise<WebPush> {
	if (configured) return configured;
	const vapid = env.vapid;
	if (!vapid) {
		throw new Error('Web Push is not configured');
	}
	const webpush = await import('web-push');
	webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
	configured = webpush;
	return webpush;
}

function subscription(row: PushSubscriptionRow) {
	return {
		endpoint: row.endpoint,
		keys: { p256dh: row.p256dh, auth: row.auth }
	};
}

/**
 * Envoie à chaque abonnement et rapporte les deux issues. Un abonnement
 * disparu (404/410) est retiré et n'est ni un succès ni un échec : il ne
 * reviendra pas. Un succès partiel n'est jamais silencieux.
 */
export async function sendPush(
	userId: string,
	message: RenderedNotification
): Promise<PushDeliveryResult> {
	const subscriptions = listPushSubscriptionsForUser(userId);
	if (subscriptions.length === 0) {
		return { delivered: 0, failed: 0, lastError: null };
	}

	const webpush = await client();
	const payload = JSON.stringify({
		title: message.title,
		body: message.body,
		url: message.url,
		tag: message.tag
	});

	let delivered = 0;
	let failed = 0;
	let lastError: unknown = null;

	for (const row of subscriptions) {
		try {
			await webpush.sendNotification(subscription(row), payload, {
				TTL: PUSH_DELIVERY.ttlSeconds,
				urgency: PUSH_DELIVERY.urgency
			});
			delivered += 1;
		} catch (error) {
			const statusCode =
				error instanceof webpush.WebPushError ? error.statusCode : null;
			if (statusCode === 404 || statusCode === 410) {
				deletePushSubscription(row.endpoint);
				logger.info('push.subscription_removed', {
					userId,
					statusCode
				});
				continue;
			}
			lastError = error;
			failed += 1;
		}
	}

	if (failed > 0) {
		logger.warn(delivered > 0 ? 'push.partial_failure' : 'push.failed', {
			userId,
			delivered,
			failed,
			error: lastError
		});
	} else {
		logger.info('push.sent', { userId, delivered });
	}

	return { delivered, failed, lastError };
}
