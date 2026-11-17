import { describe, expect, it } from 'vitest';
import { scoreLine } from './score.ts';

describe('ligne de score', () => {
	const cases = [
		{ score: { white: 3, black: 2 }, expected: 'Blanche 3 · Noire 2' },
		{ score: { white: 0, black: 0 }, expected: 'Blanche 0 · Noire 0' },
		{ score: { white: 12, black: 1 }, expected: 'Blanche 12 · Noire 1' }
	] as const;

	for (const entry of cases) {
		it(`${entry.score.white} à ${entry.score.black}`, () => {
			expect(scoreLine(entry.score)).toBe(entry.expected);
		});
	}
});
