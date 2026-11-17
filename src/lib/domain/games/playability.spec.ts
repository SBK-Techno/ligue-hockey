import { describe, expect, it } from 'vitest';
import { isGamePlayable, isLineupEditable, visibleParticipants } from './playability.ts';

/** 16 novembre 2026, 13 h à Toronto (UTC-5). */
const NOW = Date.UTC(2026, 10, 16, 18, 0);
const ZONE = 'America/Toronto';

function game(overrides: Partial<Parameters<typeof isGamePlayable>[0]> = {}) {
	return {
		status: 'scheduled',
		gameDate: '2026-11-16',
		startTime: '13:00',
		generated: true,
		...overrides
	};
}

describe('isGamePlayable', () => {
	it.each([
		['annulé dans le passé', game({ status: 'cancelled', gameDate: '2026-11-01' }), false],
		['annulé plus tard aujourd’hui', game({ status: 'cancelled', startTime: '20:00' }), false],
		['sans alignement généré', game({ generated: false, gameDate: '2026-11-01' }), false],
		['complété dans le futur', game({ status: 'completed', gameDate: '2026-12-01' }), true],
		['complété sans alignement généré', game({ status: 'completed', generated: false }), false],
		['programmé plus tôt aujourd’hui', game({ startTime: '12:00' }), true],
		['programmé exactement à l’heure de départ', game({ startTime: '13:00' }), true],
		['programmé plus tard aujourd’hui', game({ startTime: '14:00' }), false],
		['programmé hier', game({ gameDate: '2026-11-15' }), true],
		['programmé demain', game({ gameDate: '2026-11-17', startTime: '09:00' }), false]
	])('%s', (_label, value, expected) => {
		expect(isGamePlayable(value, NOW, ZONE)).toBe(expected);
	});
});

describe('isLineupEditable', () => {
	it.each([
		['à venir plus tard aujourd’hui', game({ startTime: '14:00' }), true],
		['à venir demain', game({ gameDate: '2026-11-17', startTime: '09:00' }), true],
		['commencé plus tôt aujourd’hui', game({ startTime: '12:00' }), false],
		['exactement à l’heure de départ', game({ startTime: '13:00' }), false],
		['hier', game({ gameDate: '2026-11-15' }), false],
		['annulé dans le futur', game({ status: 'cancelled', gameDate: '2026-12-01' }), false],
		['terminé dans le futur', game({ status: 'completed', gameDate: '2026-12-01' }), false],
		['sans alignement généré', game({ generated: false, gameDate: '2026-12-01' }), true]
	])('%s', (_label, value, expected) => {
		expect(isLineupEditable(value, NOW, ZONE)).toBe(expected);
	});
});

describe('visibleParticipants', () => {
	const participants = [{ playerId: 'active' }, { playerId: 'inactive' }];
	const isActive = (playerId: string) => playerId === 'active';

	it.each([
		['à venir plus tard aujourd’hui', game({ startTime: '14:00' }), ['active']],
		['à venir demain', game({ gameDate: '2026-11-17', startTime: '09:00' }), ['active']],
		['commencé plus tôt aujourd’hui', game({ startTime: '12:00' }), ['active', 'inactive']],
		['exactement à l’heure de départ', game({ startTime: '13:00' }), ['active', 'inactive']],
		['terminé', game({ status: 'completed', gameDate: '2026-11-01' }), ['active', 'inactive']],
		['annulé à venir', game({ status: 'cancelled', startTime: '14:00' }), ['active']]
	])('%s', (_label, value, expected) => {
		const visible = visibleParticipants(value, participants, isActive, NOW, ZONE);
		expect(visible.map((participant) => participant.playerId)).toEqual(expected);
	});
});
