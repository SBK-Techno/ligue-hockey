import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { NOTIFICATION_CHANNELS } from '#config/notification-channels.ts';
import {
	NOTIFICATION_EVENTS,
	NOTIFICATION_EVENT_KEYS,
	type NotificationEventKey
} from '#config/notification-events.ts';
import { renderNotification } from './templates.ts';

/**
 * Un lien de notification doit ouvrir une page réelle. On résout chaque URL
 * contre l'arbre de routes : un segment littéral doit exister, un segment
 * dynamique accepte n'importe quelle valeur, et la route doit porter une page.
 */
function routeExists(url: string, directory = 'src/routes'): boolean {
	const segments = url.split('/').filter(Boolean);
	if (segments.length === 0) return existsSync(`${directory}/+page.svelte`);
	const [head, ...rest] = segments;
	const exact = `${directory}/${head}`;
	if (existsSync(exact) && routeExists(`/${rest.join('/')}`, exact)) return true;
	return readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name.startsWith('['))
		.some((entry) => routeExists(`/${rest.join('/')}`, `${directory}/${entry.name}`));
}

const PAYLOADS: Record<NotificationEventKey, unknown> = {
	account_access: { name: 'Test', url: 'https://example.test' },
	password_reset: { name: 'Test', url: 'https://example.test' },
	sub_request: {
		gameId: 'game_test',
		requestId: 'sub_test',
		position: 'forward',
		gameDate: '2026-11-22',
		startTime: '09:00',
		location: 'Aréna de test'
	},
	sub_claimed: {
		gameId: 'game_test',
		position: 'forward',
		playerName: 'Test',
		gameDate: '2026-11-22',
		startTime: '09:00'
	},
	sub_bumped: {
		gameId: 'game_test',
		position: 'forward',
		gameDate: '2026-11-22',
		startTime: '09:00'
	},
	game_cancelled: {
		gameId: 'game_test',
		gameDate: '2026-11-22',
		startTime: '09:00',
		location: 'Aréna de test'
	},
	balance_overdue: { amountCents: 12000, currency: 'CAD', dueDate: '2026-11-22' }
};

/** Chaque événement est résolu avec son propre schéma, sans indexation générique. */
const URLS: Record<NotificationEventKey, string> = {
	account_access: NOTIFICATION_EVENTS.account_access.url(
		NOTIFICATION_EVENTS.account_access.schema.parse(PAYLOADS.account_access)
	),
	password_reset: NOTIFICATION_EVENTS.password_reset.url(
		NOTIFICATION_EVENTS.password_reset.schema.parse(PAYLOADS.password_reset)
	),
	sub_request: NOTIFICATION_EVENTS.sub_request.url(
		NOTIFICATION_EVENTS.sub_request.schema.parse(PAYLOADS.sub_request)
	),
	sub_claimed: NOTIFICATION_EVENTS.sub_claimed.url(
		NOTIFICATION_EVENTS.sub_claimed.schema.parse(PAYLOADS.sub_claimed)
	),
	sub_bumped: NOTIFICATION_EVENTS.sub_bumped.url(
		NOTIFICATION_EVENTS.sub_bumped.schema.parse(PAYLOADS.sub_bumped)
	),
	game_cancelled: NOTIFICATION_EVENTS.game_cancelled.url(
		NOTIFICATION_EVENTS.game_cancelled.schema.parse(PAYLOADS.game_cancelled)
	),
	balance_overdue: NOTIFICATION_EVENTS.balance_overdue.url(
		NOTIFICATION_EVENTS.balance_overdue.schema.parse(PAYLOADS.balance_overdue)
	)
};

describe('notification registry', () => {
	it('links every event to a route that exists', () => {
		for (const key of NOTIFICATION_EVENT_KEYS) {
			const url = URLS[key];
			expect(routeExists(url), `${key} -> ${url}`).toBe(true);
		}
	});

	it('only uses declared delivery channels', () => {
		const known = new Set(NOTIFICATION_CHANNELS.map((channel) => channel.key));
		for (const key of NOTIFICATION_EVENT_KEYS) {
			for (const channel of NOTIFICATION_EVENTS[key].channels) {
				expect(known.has(channel), `${key}: ${channel}`).toBe(true);
			}
		}
	});

	it('links game events to the match page that exists in the app', () => {
		const game = {
			gameId: 'game_test',
			requestId: 'sub_test',
			position: 'forward' as const,
			gameDate: '2026-11-22',
			startTime: '09:00',
			location: 'Aréna de test'
		};
		expect(NOTIFICATION_EVENTS.sub_request.url(game)).toBe('/matchs/game_test');
		expect(
			NOTIFICATION_EVENTS.sub_claimed.url({
				gameId: 'game_test',
				position: 'forward',
				playerName: 'Test',
				gameDate: '2026-11-22',
				startTime: '09:00'
			})
		).toBe('/matchs/game_test');
		expect(
			NOTIFICATION_EVENTS.sub_bumped.url({
				gameId: 'game_test',
				position: 'forward',
				gameDate: '2026-11-22',
				startTime: '09:00'
			})
		).toBe('/matchs/game_test');
		expect(
			NOTIFICATION_EVENTS.game_cancelled.url({
				gameId: 'game_test',
				gameDate: '2026-11-22',
				startTime: '09:00',
				location: 'Aréna de test'
			})
		).toBe('/matchs/game_test');
	});

	it('builds a branded account-access email with the reset url and expiry', () => {
		const rendered = renderNotification('account_access', {
			name: 'Max Simard',
			url: 'https://hockey.example/api/auth/reset-password/token?callbackURL=x',
			expiresInDays: 7
		});
		expect(rendered.email.actionUrl).toBe(
			'https://hockey.example/api/auth/reset-password/token?callbackURL=x'
		);
		expect(rendered.email.actionLabel).toBeTruthy();
		expect(rendered.email.note).toContain('7');
		expect(rendered.body).not.toContain('http');
	});

	it('renders in-app account-access items queued before the expiry field existed', () => {
		const rendered = renderNotification('account_access', {
			name: 'Max Simard',
			url: 'https://hockey.example/api/auth/reset-password/token?callbackURL=x'
		});
		expect(rendered.title).toBeTruthy();
		expect(rendered.email.note).toBeUndefined();
	});
});