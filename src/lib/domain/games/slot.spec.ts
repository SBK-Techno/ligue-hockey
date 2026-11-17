import { describe, expect, it } from 'vitest';
import { buildSlotDefinitions } from '#config/roster.ts';
import { candidateKey, slotKey, slotRowId } from '#config/slot.ts';
import { manualLineupInputSchema } from './validators.ts';

describe('clé de place', () => {
	it('construit la même clé pour le serveur, la carte et les scripts', () => {
		expect(slotKey({ team: 'white', position: 'forward', slotIndex: 3 })).toBe(
			'white:forward:3'
		);
		expect(slotRowId('game-1', { team: 'black', position: 'goalie', slotIndex: 0 })).toBe(
			'game-1:black:goalie:0'
		);
	});

	it('accepte chaque place construite dans le schéma d’enregistrement', () => {
		const definitions = buildSlotDefinitions({
			goaliesPerTeam: 3,
			forwardsPerTeam: 8,
			defensePerTeam: 8
		});
		const parsed = manualLineupInputSchema.parse({
			expectedGeneratedAt: null,
			assignments: definitions.map((slot) => ({
				team: slot.team,
				position: slot.position,
				slotIndex: slot.index,
				playerId: null
			}))
		});

		expect(parsed.assignments).toHaveLength(definitions.length);
		expect(new Set(definitions.map((slot) => slotKey({
			team: slot.team,
			position: slot.position,
			slotIndex: slot.index
		}))).size).toBe(definitions.length);
	});

	it('produit une clé de candidat stable quel que soit l’ordre d’arrivée', () => {
		const assignments = [
			{ team: 'white', position: 'forward', slotIndex: 0, playerId: 'a' },
			{ team: 'black', position: 'defense', slotIndex: 1, playerId: 'b' }
		] as const;

		expect(candidateKey(assignments)).toBe(candidateKey([...assignments].reverse()));
		expect(candidateKey(assignments)).toBe(
			'black:defense:1:b|white:forward:0:a'
		);
	});
});
