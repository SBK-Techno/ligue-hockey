import { z } from 'zod';
import type { I18nKey } from '#config/i18n/fr.ts';
import type { NotificationChannel } from '#config/notification-channels.ts';
import { POSITION_KEYS } from '#config/positions.ts';
import { DATE_PATTERN, TIME_PATTERN } from '#config/time.ts';

export type NotificationEventDefinition<T> = {
	schema: z.ZodType<T>;
	titleKey: I18nKey;
	bodyKey: I18nKey;
	channels: readonly NotificationChannel[];
	url: (payload: T) => string;
};

function defineEvent<T>(definition: NotificationEventDefinition<T>) {
	return definition;
}

const date = z.string().regex(DATE_PATTERN);
const time = z.string().regex(TIME_PATTERN);
const id = z.string().min(1);

export const NOTIFICATION_EVENTS = {
	account_access: defineEvent({
		schema: z.object({
			name: z.string().min(1),
			url: z.string().min(1),
			// Optional because in-app items and jobs queued before the branded
			// email existed carry the same event without an expiry.
			expiresInDays: z.number().int().min(1).max(365).optional()
		}),
		titleKey: 'notifications.accountAccess.title',
		bodyKey: 'notifications.accountAccess.body',
		channels: ['email', 'in_app'],
		url: () => '/'
	}),
	password_reset: defineEvent({
		schema: z.object({
			name: z.string().min(1),
			url: z.string().min(1),
			expiresInDays: z.number().int().min(1).max(365).optional()
		}),
		titleKey: 'notifications.passwordReset.title',
		bodyKey: 'notifications.passwordReset.body',
		channels: ['email', 'in_app'],
		url: () => '/profil'
	}),
	sub_request: defineEvent({
		schema: z.object({
			gameId: id,
			requestId: id,
			position: z.enum(POSITION_KEYS),
			gameDate: date,
			startTime: time,
			location: z.string().min(1)
		}),
		titleKey: 'notifications.subNeeded.title',
		bodyKey: 'notifications.subNeeded.body',
		channels: ['in_app', 'email', 'push'],
		url: (payload) => `/matchs/${payload.gameId}`
	}),
	sub_claimed: defineEvent({
		schema: z.object({
			gameId: id,
			position: z.enum(POSITION_KEYS),
			playerName: z.string().min(1),
			gameDate: date,
			startTime: time
		}),
		titleKey: 'notifications.subClaimed.title',
		bodyKey: 'notifications.subClaimed.body',
		channels: ['in_app', 'email', 'push'],
		url: (payload) => `/matchs/${payload.gameId}`
	}),
	sub_bumped: defineEvent({
		schema: z.object({
			gameId: id,
			position: z.enum(POSITION_KEYS),
			gameDate: date,
			startTime: time
		}),
		titleKey: 'notifications.subBumped.title',
		bodyKey: 'notifications.subBumped.body',
		channels: ['in_app', 'email', 'push'],
		url: (payload) => `/matchs/${payload.gameId}`
	}),
	game_cancelled: defineEvent({
		schema: z.object({
			gameId: id,
			gameDate: date,
			startTime: time,
			location: z.string().min(1)
		}),
		titleKey: 'notifications.gameCancelled.title',
		bodyKey: 'notifications.gameCancelled.body',
		channels: ['in_app', 'email', 'push'],
		url: (payload) => `/matchs/${payload.gameId}`
	}),
	balance_overdue: defineEvent({
		schema: z.object({
			amountCents: z.number().int().min(0),
			currency: z.string().min(3).max(3),
			dueDate: date
		}),
		titleKey: 'notifications.balanceOverdue.title',
		bodyKey: 'notifications.balanceOverdue.body',
		channels: ['in_app', 'email'],
		url: () => '/solde'
	})
} as const;

export type NotificationEventKey = keyof typeof NOTIFICATION_EVENTS;

export const NOTIFICATION_EVENT_KEYS = Object.keys(
	NOTIFICATION_EVENTS
) as NotificationEventKey[];

export function isNotificationEventKey(
	value: string
): value is NotificationEventKey {
	return value in NOTIFICATION_EVENTS;
}

export type NotificationPayload<K extends NotificationEventKey> = z.infer<
	(typeof NOTIFICATION_EVENTS)[K]['schema']
>;
