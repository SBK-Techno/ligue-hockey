import {
	NOTIFICATION_EVENTS,
	isNotificationEventKey,
	type NotificationEventDefinition,
	type NotificationEventKey,
	type NotificationPayload
} from '#config/notification-events.ts';
import type { NotificationChannel } from '#config/notification-channels.ts';
import { INBOX } from '#config/notifications.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { requirePermission, requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { db } from '#lib/server/db/index.ts';
import { AppError } from '#lib/shared/errors.ts';
import { encodeCursor, type Cursor } from '#lib/shared/paging/cursor.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import {
	claimDueJobs,
	countQueue,
	countUnread,
	deletePushSubscriptionForUser,
	findFailedJob,
	findInAppJob,
	findPreferences,
	insertJobs,
	listFailedJobs as listFailedJobRows,
	listInAppJobs,
	listPreferences,
	listPushSubscriberIds,
	markAllJobsRead,
	markFailed,
	markJobsRead,
	markSent,
	requeueFailedJob,
	requeueStaleSending,
	reschedule,
	upsertPreferences,
	upsertPushSubscription,
	type NewJob
} from './queries.ts';
import { recordSuppression } from './suppression.ts';
import { renderJob, type RenderedNotification } from './templates.ts';
import type { NotificationJobRow } from './schema.ts';
import {
	notificationPreferencesSchema,
	pushSubscriptionSchema
} from './validators.ts';

export type Recipient = { userId: string };

export type NotifyOptions = {
	dedupeKey: string;
	scheduledFor?: number;
};

export type InboxItem = {
	id: string;
	eventKey: string;
	title: string;
	body: string;
	url: string;
	createdAt: number;
	readAt: number | null;
};

function channelEnabled(channel: NotificationChannel): boolean {
	if (channel === 'in_app') return true;
	const settings = getSettings();
	return channel === 'email'
		? settings['notifications.emailEnabled']
		: settings['notifications.pushEnabled'];
}

function preferenceEnabled(
	channel: NotificationChannel,
	playerId: string,
	preferences: Map<string, { emailEnabled: boolean; pushEnabled: boolean }>
): boolean {
	const preference = preferences.get(playerId);
	if (!preference) return true;
	return channel === 'email' ? preference.emailEnabled : preference.pushEnabled;
}

export function notify<K extends NotificationEventKey>(
	eventKey: K,
	recipients: readonly Recipient[],
	payload: NotificationPayload<K>,
	options: NotifyOptions
): number {
	const definition = NOTIFICATION_EVENTS[
		eventKey
	] as unknown as NotificationEventDefinition<NotificationPayload<K>>;
	const validated = parseSchema(definition.schema, payload);
	const userIds = [...new Set(recipients.map((recipient) => recipient.userId))];
	if (userIds.length === 0) return 0;

	const preferences = new Map(
		listPreferences(userIds).map((row) => [
			row.playerId,
			{ emailEnabled: row.emailEnabled, pushEnabled: row.pushEnabled }
		])
	);
	const pushSubscribers = new Set(listPushSubscriberIds(userIds));
	const now = clock.nowMs();
	const scheduledFor = options.scheduledFor ?? now;
	const jobs: NewJob[] = [];

	for (const userId of userIds) {
		for (const channel of definition.channels) {
			if (!channelEnabled(channel)) {
				recordSuppression('channel_disabled');
				continue;
			}
			if (channel !== 'in_app' && !preferenceEnabled(channel, userId, preferences)) {
				recordSuppression('preference_disabled');
				continue;
			}
			if (channel === 'push' && !pushSubscribers.has(userId)) {
				recordSuppression('no_push_subscription');
				continue;
			}

			jobs.push({
				id: newId('job'),
				eventKey,
				userId,
				channel,
				scheduledFor,
				status: 'pending',
				payloadJson: JSON.stringify(validated),
				dedupeKey: `${options.dedupeKey}:${channel}:${userId}`,
				createdAt: now
			});
		}
	}

	return insertJobs(jobs);
}

export function sendAccountAccess(input: {
	userId: string;
	name: string;
	url: string;
	expiresInDays: number;
}): number {
	return notify(
		'account_access',
		[{ userId: input.userId }],
		{ name: input.name, url: input.url, expiresInDays: input.expiresInDays },
		{ dedupeKey: newId('account_access') }
	);
}

export function sendPasswordReset(input: {
	userId: string;
	name: string;
	url: string;
	expiresInDays: number;
}): number {
	return notify(
		'password_reset',
		[{ userId: input.userId }],
		{ name: input.name, url: input.url, expiresInDays: input.expiresInDays },
		{ dedupeKey: newId('password_reset') }
	);
}

export type NotificationPreferencesView = {
	emailEnabled: boolean;
	pushEnabled: boolean;
};

export function getNotificationPreferences(
	actor: Actor
): NotificationPreferencesView {
	const user = requireUser(actor);
	const row = findPreferences(user.userId);
	return {
		emailEnabled: row?.emailEnabled ?? true,
		pushEnabled: row?.pushEnabled ?? true
	};
}

export function updateNotificationPreferences(
	actor: Actor,
	input: { emailEnabled: unknown; pushEnabled: unknown }
): NotificationPreferencesView {
	const user = requireUser(actor);
	const parsed = parseSchema(notificationPreferencesSchema, input);
	upsertPreferences({
		playerId: user.userId,
		emailEnabled: parsed.emailEnabled,
		pushEnabled: parsed.pushEnabled,
		updatedAt: clock.nowMs()
	});
	return parsed;
}

export function subscribeToPush(
	actor: Actor,
	input: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }
): void {
	const user = requireUser(actor);
	const parsed = parseSchema(pushSubscriptionSchema, input);
	upsertPushSubscription({
		id: newId('push'),
		userId: user.userId,
		endpoint: parsed.endpoint,
		p256dh: parsed.keys.p256dh,
		auth: parsed.keys.auth,
		userAgent: parsed.userAgent ?? null,
		createdAt: clock.nowMs()
	});
}

export function unsubscribeFromPush(actor: Actor, endpoint: string): void {
	const user = requireUser(actor);
	deletePushSubscriptionForUser(user.userId, endpoint);
}

export type InboxPage = {
	items: InboxItem[];
	/** Curseur de la page suivante, ou null quand la boîte est complète. */
	nextCursor: string | null;
};

function toInboxItem(job: NotificationJobRow): InboxItem {
	const rendered = renderJob(job.eventKey, job.payloadJson);
	return {
		id: job.id,
		eventKey: job.eventKey,
		title: rendered.title,
		body: rendered.body,
		url: rendered.url,
		createdAt: job.createdAt,
		readAt: job.readAt
	};
}

/**
 * La page est lue avec un élément de plus que la taille publiée : sa présence
 * prouve qu'une page suivante existe sans compter toute la boîte. La taille
 * vient du propriétaire `INBOX`, jamais d'un paramètre de requête.
 */
export function listInboxPage(actor: Actor, before: Cursor | null): InboxPage {
	const user = requireUser(actor);
	const rows = listInAppJobs(user.userId, INBOX.pageSize + 1, before);
	const page = rows.slice(0, INBOX.pageSize);
	return {
		items: page.map(toInboxItem),
		nextCursor:
			rows.length > INBOX.pageSize && page.length > 0
				? encodeCursor(page[page.length - 1])
				: null
	};
}

export function unreadCount(actor: Actor): number {
	const user = requireUser(actor);
	return countUnread(user.userId);
}

/** Efface toute la boîte, pas seulement la page affichée. */
export function markAllInboxRead(actor: Actor): number {
	const user = requireUser(actor);
	return markAllJobsRead(user.userId, clock.nowMs());
}

export function openInboxItem(actor: Actor, id: string): string {
	const user = requireUser(actor);
	const job = findInAppJob(user.userId, id);
	if (!job) {
		throw new AppError('NOT_FOUND', { key: 'error.notFound' });
	}
	markJobsRead(user.userId, [id], clock.nowMs());
	return renderJob(job.eventKey, job.payloadJson).url;
}

export function claimJobs(now: number, limit: number): NotificationJobRow[] {
	return claimDueJobs(now, limit);
}

export function requeueStale(cutoff: number): number {
	return requeueStaleSending(cutoff);
}

export function completeJob(jobId: string): void {
	markSent(jobId, clock.nowMs());
}

export function jobMessage(job: NotificationJobRow): RenderedNotification {
	if (!isNotificationEventKey(job.eventKey)) {
		throw new AppError('INTERNAL', {
			message: `Unknown notification event: ${job.eventKey}`
		});
	}
	const rendered = renderJob(job.eventKey, job.payloadJson);
	if (!rendered.title || !rendered.body) {
		throw new AppError('INTERNAL', {
			message: `Empty notification template: ${job.eventKey}`
		});
	}
	return rendered;
}

export function failJob(jobId: string, error: unknown): void {
	markFailed(jobId, error instanceof Error ? error.message : String(error));
}

export function retryJob(job: NotificationJobRow, error: unknown, retryAt: number): void {
	reschedule(
		job.id,
		retryAt,
		error instanceof Error ? error.message : String(error)
	);
}

export function queueCounts(): {
	pending: number;
	failed: number;
	oldestDueAt: number | null;
} {
	return countQueue();
}

export type FailedJobView = {
	id: string;
	eventKey: string;
	channel: string;
	attempts: number;
	scheduledFor: number;
	lastError: string | null;
};

export function listFailedJobs(actor: Actor): FailedJobView[] {
	requirePermission(actor, 'manageSettings');
	return listFailedJobRows(INBOX.failedPageSize).map((job) => ({
		id: job.id,
		eventKey: job.eventKey,
		channel: job.channel,
		attempts: job.attempts,
		scheduledFor: job.scheduledFor,
		lastError: job.lastError
	}));
}

/**
 * Relance un envoi échoué. La reprise et sa trace d'audit partagent la même
 * transaction : aucun opérateur ne peut relancer sans laisser de trace.
 */
export function retryFailedJob(actor: Actor, jobId: string): void {
	requirePermission(actor, 'manageSettings');
	const job = findFailedJob(jobId);
	if (!job) {
		throw new AppError('NOT_FOUND', { key: 'error.notFound' });
	}
	db.transaction((tx) => {
		if (requeueFailedJob(jobId, clock.nowMs(), tx) === 0) {
			throw new AppError('CONFLICT', { key: 'error.notFound' });
		}
		recordAudit(
			actor,
			{
				action: 'notification.retry',
				entityType: 'notification',
				entityId: jobId,
				metadata: { eventKey: job.eventKey, channel: job.channel }
			},
			tx
		);
	});
}
