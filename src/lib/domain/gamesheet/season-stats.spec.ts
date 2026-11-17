import { describe, expect, it } from 'vitest';
import { deriveSeasonStats } from './season-stats.ts';

describe('dérivation des stats de saison', () => {
	const cases = [
		{
			name: 'aucun match terminé',
			totals: { games: 0, goals: 0, assists: 0, penaltyMinutes: 0 },
			expected: { points: 0, pointsPerGame: 0 }
		},
		{
			name: 'deux buts et une aide en un match',
			totals: { games: 1, goals: 2, assists: 1, penaltyMinutes: 0 },
			expected: { points: 3, pointsPerGame: 3 }
		},
		{
			name: 'les points se répartissent sur les matchs joués',
			totals: { games: 4, goals: 3, assists: 5, penaltyMinutes: 2 },
			expected: { points: 8, pointsPerGame: 2 }
		},
		{
			name: 'la moyenne reste une fraction exacte',
			totals: { games: 3, goals: 1, assists: 1, penaltyMinutes: 0 },
			expected: { points: 2, pointsPerGame: 2 / 3 }
		}
	] as const;

	for (const entry of cases) {
		it(entry.name, () => {
			expect(deriveSeasonStats(entry.totals)).toEqual({
				...entry.totals,
				...entry.expected
			});
		});
	}

	it('ne produit que des nombres propres à la saison', () => {
		const stats = deriveSeasonStats({
			games: 2,
			goals: 1,
			assists: 2,
			penaltyMinutes: 1
		});
		expect(Object.keys(stats).sort()).toEqual([
			'assists',
			'games',
			'goals',
			'penaltyMinutes',
			'points',
			'pointsPerGame'
		]);
	});
});
