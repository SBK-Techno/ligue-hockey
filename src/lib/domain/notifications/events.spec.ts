import { describe, expect, it } from 'vitest';
import { fr } from '#config/i18n/fr.ts';
import { NOTIFICATION_CHANNELS } from '#config/notification-channels.ts';
import {
	NOTIFICATION_EVENTS,
	NOTIFICATION_EVENT_KEYS
} from '#config/notification-events.ts';
import { renderNotification } from './templates.ts';

describe('notification registry', () => {
	it('provides French title and body copy for every event', () => {
		for (const key of NOTIFICATION_EVENT_KEYS) {
			const definition = NOTIFICATION_EVENTS[key];
			expect(fr[definition.titleKey], `${key} title`).toBeTruthy();
			expect(fr[definition.bodyKey], `${key} body`).toBeTruthy();
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