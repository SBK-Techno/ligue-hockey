import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	RATING_ATTRIBUTE_KEYS,
	RATING_SCALE
} from '#config/rating-attributes.ts';
import type { Actor } from '../auth/types.ts';
import type { RatingsInput } from './validators.ts';

const { upsertRatings, listRatings, getPlayer } = vi.hoisted(() => ({
	upsertRatings: vi.fn<
		(playerId: string, values: Record<string, number>, at: number, by: string | null) => void
	>(),
	listRatings: vi.fn<
		(playerId: string) => Array<{
			playerId: string;
			attribute: string;
			value: number;
			updatedAt: number;
			updatedBy: string | null;
		}>
	>(() => []),
	getPlayer: vi.fn()
}));

vi.mock('./queries.ts', () => ({
	upsertRatings,
	listRatings
}));

vi.mock('#lib/domain/players/service.ts', () => ({
	getPlayer
}));

vi.mock('#lib/domain/audit/service.ts', () => ({
	recordAudit: vi.fn()
}));

vi.mock('#lib/domain/games/upcoming.ts', () => ({
	regenerateUpcomingGeneratedGames: vi.fn()
}));

const admin: Actor = { kind: 'user', userId: 'admin', name: 'Admin', role: 'admin' };
const player: Actor = { kind: 'user', userId: 'player', name: 'Player', role: 'player' };

function completeRatings(): RatingsInput {
	return Object.fromEntries(
		RATING_ATTRIBUTE_KEYS.map((key) => [key, RATING_SCALE.min])
	) as RatingsInput;
}

/** setRatings is synchronous: capture its throw instead of using `rejects`. */
function thrownBy(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	return undefined;
}

describe('setRatings', () => {
	beforeEach(() => {
		upsertRatings.mockClear();
		listRatings.mockClear();
		listRatings.mockReturnValue([]);
		getPlayer.mockClear();
	});

	it.each([
		['below the scale', RATING_SCALE.min - 1],
		['above the scale', RATING_SCALE.max + 1],
		['not a number', 'abc'],
		['fractional', RATING_SCALE.min + 0.5]
	])('rejects a value %s without writing', async (_label, value) => {
		const { setRatings } = await import('./service.ts');
		const input = { ...completeRatings(), [RATING_ATTRIBUTE_KEYS[0]]: value };

		expect(thrownBy(() => setRatings(admin, 'target', input as never))).toMatchObject({
			code: 'VALIDATION'
		});
		expect(upsertRatings).not.toHaveBeenCalled();
	});

	it('rejects an incomplete rating sheet', async () => {
		const { setRatings } = await import('./service.ts');
		const input = completeRatings() as Record<string, number>;
		delete input[RATING_ATTRIBUTE_KEYS[0]];

		expect(thrownBy(() => setRatings(admin, 'target', input as never))).toMatchObject({
			code: 'VALIDATION'
		});
		expect(upsertRatings).not.toHaveBeenCalled();
	});

	it('writes a complete sheet and returns the stored view', async () => {
		const { setRatings } = await import('./service.ts');
		const input = completeRatings();
		listRatings.mockReturnValueOnce(
			RATING_ATTRIBUTE_KEYS.map((attribute) => ({
				playerId: 'target',
				attribute,
				value: input[attribute],
				updatedAt: 1_700_000_000_000,
				updatedBy: 'admin'
			}))
		);

		const view = setRatings(admin, 'target', input);

		expect(upsertRatings).toHaveBeenCalledWith('target', input, expect.any(Number), 'admin');
		expect(view.playerId).toBe('target');
		expect(view.overall).not.toBeNull();
		expect(view.updatedAt).toBe(1_700_000_000_000);
	});

	it('denies an actor without the rating capability', async () => {
		const { setRatings } = await import('./service.ts');

		expect(thrownBy(() => setRatings(player, 'target', completeRatings()))).toMatchObject({
			code: 'FORBIDDEN'
		});
		expect(upsertRatings).not.toHaveBeenCalled();
	});
});
