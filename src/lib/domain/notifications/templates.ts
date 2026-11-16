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

export type RenderedNotification = {
	title: string;
	body: string;
	url: string;
	tag: string;
};

export function renderNotification<K extends NotificationEventKey>(
	eventKey: K,
	payload: NotificationPayload<K>
): RenderedNotification {
	const definition = NOTIFICATION_EVENTS[eventKey];
	const params = (RENDERERS[eventKey] as (value: NotificationPayload<K>) => Params)(
		payload
	);

	return {
		title: t(definition.titleKey as I18nKey, params),
		body: t(definition.bodyKey as I18nKey, params),
		url: (definition.url as (value: NotificationPayload<K>) => string)(payload),
		tag: eventKey
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
