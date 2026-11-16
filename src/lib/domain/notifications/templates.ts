import {
	NOTIFICATION_EVENTS,
	type NotificationEventKey,
	type NotificationPayload
} from '#config/notification-events.ts';
import { positionDefinition } from '#config/positions.ts';
import { formatDate, formatMoney, formatTime, t } from '#lib/shared/i18n/index.ts';
import type { I18nKey } from '#config/i18n/fr.ts';

type Params = Record<string, string | number>;

type RendererMap = {
	[K in NotificationEventKey]: (payload: NotificationPayload<K>) => Params;
};

const RENDERERS: RendererMap = {
	account_access: (payload) => ({
		name: payload.name,
		url: payload.url
	}),
	password_reset: (payload) => ({
		name: payload.name,
		url: payload.url
	}),
	sub_request: (payload) => ({
		position: t(positionDefinition(payload.position).labelKey),
		date: formatDate(payload.gameDate),
		time: formatTime(payload.startTime),
		location: payload.location
	}),
	sub_claimed: (payload) => ({
		name: payload.playerName,
		position: t(positionDefinition(payload.position).labelKey),
		date: formatDate(payload.gameDate),
		time: formatTime(payload.startTime)
	}),
	sub_bumped: (payload) => ({
		position: t(positionDefinition(payload.position).labelKey),
		date: formatDate(payload.gameDate),
		time: formatTime(payload.startTime)
	}),
	game_cancelled: (payload) => ({
		date: formatDate(payload.gameDate),
		time: formatTime(payload.startTime),
		location: payload.location
	}),
	balance_overdue: (payload) => ({
		amount: formatMoney(payload.amountCents, payload.currency),
		date: formatDate(payload.dueDate)
	})
};

export type EmailView = {
	heading: string;
	greeting?: string;
	paragraphs: string[];
	actionLabel: string;
	actionUrl: string;
	note?: string;
	ignore?: string;
};

export type RenderedNotification = {
	title: string;
	body: string;
	url: string;
	tag: string;
	email: EmailView;
};

export function renderNotification<K extends NotificationEventKey>(
	eventKey: K,
	payload: NotificationPayload<K>
): RenderedNotification {
	const definition = NOTIFICATION_EVENTS[eventKey];
	const params = (RENDERERS[eventKey] as (value: NotificationPayload<K>) => Params)(
		payload
	);
	const title = t(definition.titleKey as I18nKey, params);
	const body = t(definition.bodyKey as I18nKey, params);
	const url = (definition.url as (value: NotificationPayload<K>) => string)(payload);

	const email: EmailView = {
		heading: title,
		paragraphs: [body],
		actionLabel: t('email.openApp'),
		actionUrl: url
	};

	if (eventKey === 'account_access') {
		const account = payload as NotificationPayload<'account_access'>;
		email.greeting = t('email.greeting', { name: account.name });
		email.paragraphs = [t('email.accountAccess.lead')];
		email.actionLabel = t('email.accountAccess.cta');
		email.actionUrl = account.url;
		if (account.expiresInDays !== undefined) {
			email.note = t('email.accountAccess.expiry', {
				count: account.expiresInDays
			});
		}
		email.ignore = t('email.accountAccess.ignore');
	}

	if (eventKey === 'password_reset') {
		const account = payload as NotificationPayload<'password_reset'>;
		email.greeting = t('email.greeting', { name: account.name });
		email.paragraphs = [t('email.passwordReset.lead')];
		email.actionLabel = t('email.passwordReset.cta');
		email.actionUrl = account.url;
		if (account.expiresInDays !== undefined) {
			email.note = t('email.accountAccess.expiry', {
				count: account.expiresInDays
			});
		}
		email.ignore = t('email.passwordReset.ignore');
	}

	return {
		title,
		body,
		url,
		tag: eventKey,
		email
	};
}

export function renderJob(
	eventKey: string,
	payloadJson: string
): RenderedNotification {
	if (!(eventKey in NOTIFICATION_EVENTS)) {
		throw new Error(`Unknown notification event: ${eventKey}`);
	}

	const key = eventKey as NotificationEventKey;
	const definition = NOTIFICATION_EVENTS[key];
	const payload = definition.schema.parse(JSON.parse(payloadJson));
	return renderNotification(key, payload as NotificationPayload<typeof key>);
}
