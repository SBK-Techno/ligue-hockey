import { describe, expect, it } from 'vitest';
import { fr } from '#config/i18n/fr.ts';
import { NOTIFICATION_CHANNELS } from '#config/notification-channels.ts';
import {
	NOTIFICATION_EVENTS,
	NOTIFICATION_EVENT_KEYS
} from '#config/notification-events.ts';

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
});
