import { describe, expect, it } from 'vitest';
import {
	clearPeekCache,
	readPeekCache,
	writePeekCache,
	type PeekCache
} from './player-peek-cache.ts';

type View = { withRatings: boolean };

describe('portée du cache des fiches joueur', () => {
	it('ressert une fiche dans la même portée et dans la fenêtre courte', () => {
		const cache: PeekCache<View> = {};
		const view = { withRatings: true };
		writePeekCache(cache, 'ratings', 'player-1', view, 1_000);

		expect(readPeekCache(cache, 'ratings', 'player-1', 20_000, 30_000)).toBe(view);
	});

	it('ne resservit jamais une fiche à notes après une perte de capacité', () => {
		const cache: PeekCache<View> = {};
		writePeekCache(cache, 'ratings', 'player-1', { withRatings: true }, 1_000);

		expect(readPeekCache(cache, 'public', 'player-1', 2_000, 30_000)).toBeNull();
	});

	it('oublie tout quand la portée change', () => {
		const cache: PeekCache<View> = {};
		writePeekCache(cache, 'ratings', 'player-1', { withRatings: true }, 1_000);

		clearPeekCache(cache);

		expect(readPeekCache(cache, 'ratings', 'player-1', 1_001, 30_000)).toBeNull();
	});

	it('laisse expirer une entrée après la fenêtre', () => {
		const cache: PeekCache<View> = {};
		writePeekCache(cache, 'public', 'player-1', { withRatings: false }, 1_000);

		expect(readPeekCache(cache, 'public', 'player-1', 31_000, 30_000)).toBeNull();
	});
});
