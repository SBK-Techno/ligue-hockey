import { describe, expect, it } from 'vitest';
import type { RosterTemplate } from '#config/roster.ts';
import { selectPool, type PoolAvailability, type PoolClaim, type PoolPlayer } from './selection.ts';

const template: RosterTemplate = {
	forwardsPerTeam: 3,
	defensePerTeam: 2,
	goaliesPerTeam: 1
};

function regular(id: string, position: PoolPlayer['position'], age = 30): PoolPlayer {
	return {
		playerId: id,
		position,
		age,
		isSubstitute: false,
		active: true
	};
}

function sub(id: string, position: PoolPlayer['position'], age = 30): PoolPlayer {
	return {
		playerId: id,
		position,
		age,
		isSubstitute: true,
		active: true
	};
}

function present(ids: readonly string[], offset = 0): PoolAvailability[] {
	return ids.map((playerId, index) => ({
		playerId,
		status: 'present',
		updatedAt: 1000 + offset + index
	}));
}

function claim(id: string, position: PoolClaim['position'], filledAt = 500): PoolClaim {
	return { playerId: id, position, filledAt };
}

describe('selectPool', () => {
	it('fills every positional slot when the roster is complete', () => {
		const players = [
			regular('f1', 'forward'),
			regular('f2', 'forward'),
			regular('f3', 'forward'),
			regular('f4', 'forward'),
			regular('f5', 'forward'),
			regular('f6', 'forward'),
			regular('d1', 'defense'),
			regular('d2', 'defense'),
			regular('d3', 'defense'),
			regular('d4', 'defense'),
			regular('g1', 'goalie'),
			regular('g2', 'goalie')
		];
		const result = selectPool({
			template,
			players,
			availability: present(players.map((player) => player.playerId)),
			claims: []
		});

		expect(result.selected).toHaveLength(12);
		expect(result.bench).toHaveLength(0);
	});

	it('benches the latest regulars beyond each position capacity', () => {
		const players = [
			regular('f1', 'forward'),
			regular('f2', 'forward'),
			regular('f3', 'forward'),
			regular('f4', 'forward'),
			regular('f5', 'forward'),
			regular('f6', 'forward'),
			regular('f7', 'forward')
		];
		const result = selectPool({
			template,
			players,
			availability: present(players.map((player) => player.playerId)),
			claims: []
		});

		expect(result.selected.map((entry) => entry.playerId)).not.toContain('f7');
		expect(result.bench).toEqual([
			{ playerId: 'f7', position: 'forward', kind: 'regular' }
		]);
	});

	it('reserves the claimed spot before filling regulars', () => {
		const players = [
			regular('f1', 'forward'),
			regular('f2', 'forward'),
			regular('f3', 'forward'),
			regular('f4', 'forward'),
			regular('f5', 'forward'),
			regular('f6', 'forward'),
			sub('s1', 'forward')
		];
		const result = selectPool({
			template,
			players,
			availability: present(players.filter((p) => !p.isSubstitute).map((p) => p.playerId)),
			claims: [claim('s1', 'forward')]
		});

		expect(result.selected.map((entry) => entry.playerId)).toContain('s1');
		expect(result.bench).toEqual([
			{ playerId: 'f6', position: 'forward', kind: 'regular' }
		]);
	});

	it('benches a claimed substitute beyond position capacity', () => {
		const players = [
			regular('f1', 'forward'),
			regular('f2', 'forward'),
			regular('f3', 'forward'),
			regular('f4', 'forward'),
			regular('f5', 'forward'),
			regular('f6', 'forward'),
			sub('s1', 'forward'),
			sub('s2', 'forward')
		];
		const result = selectPool({
			template,
			players,
			availability: present(players.filter((p) => !p.isSubstitute).map((p) => p.playerId)),
			claims: [claim('s1', 'forward', 100), claim('s2', 'forward', 200)]
		});

		expect(result.selected.map((entry) => entry.playerId)).toEqual(
			expect.arrayContaining(['s1', 's2'])
		);
		expect(result.bench).toEqual(
			expect.arrayContaining([
				{ playerId: 'f5', position: 'forward', kind: 'regular' },
				{ playerId: 'f6', position: 'forward', kind: 'regular' }
			])
		);
	});

	it('ignores absent, inactive, and substitute availability rows', () => {
		const players = [
			regular('f1', 'forward'),
			regular('f2', 'forward'),
			{ ...regular('f3', 'forward'), active: false },
			sub('s1', 'forward')
		];
		const result = selectPool({
			template,
			players,
			availability: [
				...present(['f1']),
				{ playerId: 'f2', status: 'absent', updatedAt: 1 },
				...present(['f3']),
				...present(['s1'])
			],
			claims: []
		});

		expect(result.selected.map((entry) => entry.playerId)).toEqual(['f1']);
	});

	it('keeps an unavailable roster empty instead of inventing players', () => {
		const result = selectPool({
			template,
			players: [],
			availability: [],
			claims: []
		});

		expect(result.selected).toEqual([]);
		expect(result.bench).toEqual([]);
	});
});
