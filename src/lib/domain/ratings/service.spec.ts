import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	RATING_ATTRIBUTE_KEYS,
	RATING_SCALE
} from '#config/rating-attributes.ts';
import type { Actor } from '../auth/types.ts';
import type { RatingsInput } from './validators.ts';

const {
	replaceSeasonRatings,
	listRatings,
	listPlayerGameRatings,
	listRatingsForPlayers,
	getPlayer,
	listRatingPlayers
} = vi.hoisted(() => ({
		replaceSeasonRatings: vi.fn<
			(
				playerId: string,
				values: Record<string, number>,
				managed: readonly string[],
				at: number,
				by: string | null
			) => void
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
		listPlayerGameRatings: vi.fn<
			(playerId: string) => Array<{
				gameId: string;
				gameDate: string;
				startTime: string;
				attribute: string;
				value: number;
			}>
		>(() => []),
		listRatingsForPlayers: vi.fn(() => []),
		getPlayer: vi.fn(() => ({ position: 'forward' })),
		listRatingPlayers: vi.fn(() => [])
	}));

vi.mock('./queries.ts', () => ({
	replaceSeasonRatings,
	listRatings,
	listPlayerGameRatings,
	listRatingsForPlayers,
	upsertGameRating: vi.fn(),
	replaceGameRatings: vi.fn()
}));

vi.mock('#lib/domain/players/service.ts', () => ({
	getPlayer,
	listRatingPlayers
}));

vi.mock('#lib/domain/audit/service.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/domain/audit/service.ts')>();
	return { ...actual, recordAudit: vi.fn() };
});
vi.mock('#lib/domain/audit/queries.ts', () => ({ insertAudit: vi.fn() }));

vi.mock('#lib/domain/games/upcoming.ts', () => ({
	regenerateUpcomingGeneratedGames: vi.fn()
}));

const admin: Actor = { kind: 'user', active: true, userId: 'admin', name: 'Admin', role: 'admin' };
const player: Actor = { kind: 'user', active: true, userId: 'player', name: 'Player', role: 'player' };
const manager: Actor = { kind: 'user', active: true, userId: 'manager', name: 'Manager', role: 'manager' };

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
		replaceSeasonRatings.mockClear();
		listRatings.mockClear();
		listRatings.mockReturnValue([]);
		listPlayerGameRatings.mockReturnValue([]);
		listRatingsForPlayers.mockReturnValue([]);
		listRatingPlayers.mockReturnValue([]);
		getPlayer.mockClear();
		getPlayer.mockReturnValue({ position: 'forward' });
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
		expect(replaceSeasonRatings).not.toHaveBeenCalled();
	});

	it('saves a partial sheet and lets the owner clear only the missing managed keys', async () => {
		const { setRatings } = await import('./service.ts');
		const input = completeRatings() as Record<string, number>;
		delete input[RATING_ATTRIBUTE_KEYS[0]];

		setRatings(admin, 'target', input as never);

		expect(replaceSeasonRatings).toHaveBeenCalledWith(
			'target',
			input,
			expect.arrayContaining([...RATING_ATTRIBUTE_KEYS]),
			expect.any(Number),
			'admin',
			expect.anything()
		);
	});

	it('writes a complete sheet and returns the stored view', async () => {
		const { setRatings } = await import('./service.ts');
		const input = completeRatings();
		listRatings.mockReturnValueOnce(
			RATING_ATTRIBUTE_KEYS.map((attribute) => ({
				playerId: 'target',
				attribute,
				value: input[attribute] ?? RATING_SCALE.min,
				updatedAt: 1_700_000_000_000,
				updatedBy: 'admin'
			}))
		);

		const view = setRatings(admin, 'target', input);

		expect(replaceSeasonRatings).toHaveBeenCalledWith(
			'target',
			input,
			expect.arrayContaining([...RATING_ATTRIBUTE_KEYS]),
			expect.any(Number),
			'admin',
			expect.anything()
		);
		expect(view.playerId).toBe('target');
		expect(view.overall).not.toBeNull();
		expect(view.updatedAt).toBe(1_700_000_000_000);
	});

	it('keeps position criteria beside the four league notes', async () => {
		const { setRatings } = await import('./service.ts');

		setRatings(admin, 'target', completeRatings(), { forecheck: 4 });

		expect(replaceSeasonRatings).toHaveBeenCalledWith(
			'target',
			{ ...completeRatings(), forecheck: 4 },
			expect.arrayContaining([...RATING_ATTRIBUTE_KEYS, 'forecheck']),
			expect.any(Number),
			'admin',
			expect.anything()
		);
	});

	it('rejects a position criterion that does not belong to the player', async () => {
		const { setRatings } = await import('./service.ts');

		expect(
			thrownBy(() =>
				setRatings(admin, 'target', completeRatings(), { goaliePositioning: 4 })
			)
		).toMatchObject({ code: 'VALIDATION' });
		expect(replaceSeasonRatings).not.toHaveBeenCalled();
	});

	it('computes recent form from the last evaluated games only', async () => {
		const { getRatings } = await import('./service.ts');
		listPlayerGameRatings.mockReturnValue([
			{ gameId: 'g5', gameDate: '2026-11-16', startTime: '09:00', attribute: 'impact', value: 5 },
			{ gameId: 'g5', gameDate: '2026-11-16', startTime: '09:00', attribute: 'effort', value: 5 },
			{ gameId: 'g4', gameDate: '2026-11-09', startTime: '09:00', attribute: 'impact', value: 3 },
			{ gameId: 'g4', gameDate: '2026-11-09', startTime: '09:00', attribute: 'effort', value: 3 }
		]);

		const view = getRatings(admin, 'target');

		expect(view.form.games).toBe(2);
		expect(view.form.average).toBe(4);
	});

	it('summarises the season and position completion for the hub', async () => {
		const { evaluationOverviews } = await import('./service.ts');
		listRatingPlayers.mockReturnValue([
			{ userId: 'p1', fullName: 'Alex Tremblay', position: 'forward' }
		] as never);
		listRatingsForPlayers.mockReturnValue([
			{ playerId: 'p1', attribute: 'passing', value: 4 },
			{ playerId: 'p1', attribute: 'speed', value: 4 },
			{ playerId: 'p1', attribute: 'agility', value: 4 },
			{ playerId: 'p1', attribute: 'backchecking', value: 4 },
			{ playerId: 'p1', attribute: 'forecheck', value: 5 }
		] as never);

		const [overview] = evaluationOverviews(admin);

		expect(overview.overall).toBe(4);
		expect(overview.positionCompleted).toBe(1);
		expect(overview.positionTotal).toBe(3);
	});

	it('keeps the official overall null when only position criteria exist', async () => {
		const { getRatings } = await import('./service.ts');
		listRatings.mockReturnValue([
			{
				playerId: 'target',
				attribute: 'forecheck',
				value: 5,
				updatedAt: 1,
				updatedBy: 'admin'
			}
		]);

		const view = getRatings(admin, 'target');

		expect(view.overall).toBeNull();
		expect(view.positionOverall).toBe(5);
		expect(view.positionComplete).toBe(false);
	});

	it('scopes position values to the current poste', async () => {
		const { getRatings } = await import('./service.ts');
		listRatings.mockReturnValue([
			{
				playerId: 'target',
				attribute: 'goaliePositioning',
				value: 5,
				updatedAt: 1,
				updatedBy: 'admin'
			},
			{
				playerId: 'target',
				attribute: 'forecheck',
				value: 4,
				updatedAt: 1,
				updatedBy: 'admin'
			}
		]);

		const view = getRatings(admin, 'target');

		expect(view.positionValues).toEqual({ forecheck: 4 });
		expect(view.positionTotal).toBe(3);
	});

	it('orders recent form by date then start time and keeps five games', async () => {
		const { getRatings } = await import('./service.ts');
		listPlayerGameRatings.mockReturnValue([
			{ gameId: 'old', gameDate: '2026-11-10', startTime: '08:00', attribute: 'impact', value: 1 },
			{ gameId: 'a', gameDate: '2026-11-10', startTime: '09:00', attribute: 'impact', value: 2 },
			{ gameId: 'b', gameDate: '2026-11-10', startTime: '09:00', attribute: 'impact', value: 3 },
			{ gameId: 'c', gameDate: '2026-11-10', startTime: '09:00', attribute: 'impact', value: 4 },
			{ gameId: 'd', gameDate: '2026-11-10', startTime: '09:00', attribute: 'impact', value: 5 },
			{ gameId: 'e', gameDate: '2026-11-10', startTime: '09:00', attribute: 'impact', value: 5 }
		]);

		const view = getRatings(admin, 'target');

		expect(view.form.games).toBe(5);
		expect(view.form.average).toBe(3.8);
	});

	it('ignores recent-form rows for another poste', async () => {
		const { getRatings } = await import('./service.ts');
		listPlayerGameRatings.mockReturnValue([
			{ gameId: 'g1', gameDate: '2026-11-10', startTime: '09:00', attribute: 'goaliePositioning', value: 5 },
			{ gameId: 'g2', gameDate: '2026-11-11', startTime: '09:00', attribute: 'impact', value: 3 }
		]);

		expect(getRatings(admin, 'target').form).toEqual({ average: 3, games: 1 });
	});

	it('marks a season with a partial poste as incomplete', async () => {
		const { evaluationOverviews } = await import('./service.ts');
		listRatingPlayers.mockReturnValue([
			{ userId: 'p1', fullName: 'Alex Tremblay', position: 'forward' }
		] as never);
		listRatingsForPlayers.mockReturnValue([
			{ playerId: 'p1', attribute: 'passing', value: 4 },
			{ playerId: 'p1', attribute: 'speed', value: 4 },
			{ playerId: 'p1', attribute: 'agility', value: 4 },
			{ playerId: 'p1', attribute: 'backchecking', value: 4 },
			{ playerId: 'p1', attribute: 'forecheck', value: 5 }
		] as never);

		const [overview] = evaluationOverviews(admin);

		expect(overview.overall).toBe(4);
		expect(overview.complete).toBe(false);
	});

	it('denies an actor without the rating capability', async () => {
		const { setRatings } = await import('./service.ts');

		expect(thrownBy(() => setRatings(player, 'target', completeRatings()))).toMatchObject({
			code: 'FORBIDDEN'
		});
		expect(replaceSeasonRatings).not.toHaveBeenCalled();
	});

	it('denies the evaluation hub to a manager without editRatings', async () => {
		const { evaluationOverviews } = await import('./service.ts');

		expect(thrownBy(() => evaluationOverviews(manager))).toMatchObject({
			code: 'FORBIDDEN'
		});
		expect(listRatingPlayers).not.toHaveBeenCalled();
	});
});

describe('positionRatingKeysToClear', () => {
	it.each([
		['forward', 'defense', ['forecheck', 'netFront', 'wallPlay']],
		['defense', 'goalie', ['gapControl', 'firstPass', 'netFrontDefence']]
	] as const)('clears the %s criteria when moving to %s', async (from, to, keys) => {
		const { positionRatingKeysToClear } = await import('#config/rating-attributes.ts');

		expect(positionRatingKeysToClear(to, keys)).toEqual([...keys]);
		expect(positionRatingKeysToClear(from, keys)).toEqual([]);
	});

	it('keeps the four league notes when the poste changes', async () => {
		const { positionRatingKeysToClear } = await import('#config/rating-attributes.ts');

		expect(
			positionRatingKeysToClear('defense', ['passing', 'forecheck', 'impact'])
		).toEqual(['forecheck']);
	});
});
