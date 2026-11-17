import { isHttpError } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';
import type { LineupIntelligence } from '#lib/domain/games/alignment.ts';
import type { GameView, TeamHistoryEntry } from '#lib/domain/games/service.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';
import { TEAM_SECTION } from '#config/teams.ts';

vi.mock('#lib/domain/games/service.ts', () => ({
	getGame: vi.fn(),
	listSchedule: vi.fn(),
	listTeamHistory: vi.fn(),
	regenerateAsAdmin: vi.fn()
}));

vi.mock('#lib/domain/games/alignment.ts', () => ({
	applyBestSwap: vi.fn(),
	fillOpenSlots: vi.fn(),
	lineupIntelligence: vi.fn()
}));

vi.mock('#lib/domain/games/lineup.ts', () => ({
	saveManualLineup: vi.fn()
}));

vi.mock('#lib/domain/games/playability.ts', () => ({
	isLineupEditable: vi.fn()
}));

const { getGame, listSchedule, listTeamHistory } = await import(
	'#lib/domain/games/service.ts'
);
const { lineupIntelligence } = await import('#lib/domain/games/alignment.ts');
const { isLineupEditable } = await import('#lib/domain/games/playability.ts');
const { load } = await import('./+page.server.ts');

const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'player',
	name: 'Joueur',
	role: 'player'
};

const manager: Actor = {
	kind: 'user',
	active: true,
	userId: 'manager',
	name: 'Gérant',
	role: 'manager'
};

function summary(
	id: string,
	gameDate: string,
	status: GameSummary['status'] = 'scheduled'
): GameSummary {
	return {
		id,
		gameDate,
		startTime: '08:30',
		locationId: 'loc',
		location: 'Aréna',
		status
	};
}

function gameView(id: string, gameDate: string, status: GameView['status']): GameView {
	return {
		...summary(id, gameDate, status),
		notes: null,
		locationAddress: null,
		locationMapUrl: null,
		slots: [
			{
				team: 'black',
				position: 'defense',
				slotIndex: 0,
				player: {
					playerId: 'player',
					fullName: 'Joueur Test',
					position: 'defense',
					jerseyNumber: 4,
					avatarId: null,
					kind: 'regular'
				}
			}
		],
		generation: {
			skillDiff: 0,
			ageDiff: 0,
			sizeDiff: 0,
			skillDiffLabel: null,
			ageDiffLabel: null,
			warnings: [],
			ruleViolations: [],
			bench: [],
			generatedAt: 1
		},
		completedAt: status === 'completed' ? 1 : null,
		lineupManualAt: null,
		openSlots: 0,
		openSlotsLabel: '',
		lineupComplete: true,
		generated: true,
		updatedAt: 1
	};
}

const intelligence: LineupIntelligence = {
	complete: true,
	openSlots: 0,
	placed: 1,
	skillDiff: 0,
	ageDiff: 0,
	sizeDiff: 0,
	averages: { white: null, black: null },
	sizes: { white: 0, black: 1 },
	swap: null,
	fills: { count: 0, names: [] },
	benchNames: [],
	unratedNames: []
};

function historyEntry(id: string, gameDate: string): TeamHistoryEntry {
	return {
		...summary(id, gameDate, 'completed'),
		generated: true,
		openSlots: 0,
		openSlotsLabel: '',
		counts: { white: 6, black: 6 }
	};
}

async function run(
	actor: Actor,
	params: { id: string },
	options: { hasPlayerProfile?: boolean } = {}
) {
	return load({
		locals: { actor },
		params,
		parent: async () => ({ hasPlayerProfile: options.hasPlayerProfile ?? true })
	} as never);
}

beforeEach(() => {
	vi.mocked(getGame).mockReset();
	vi.mocked(listSchedule).mockReset();
	vi.mocked(listTeamHistory).mockReset();
	vi.mocked(lineupIntelligence).mockReset();
	vi.mocked(isLineupEditable).mockReset();
	vi.mocked(isLineupEditable).mockReturnValue(true);
	vi.mocked(lineupIntelligence).mockReturnValue(intelligence);
	vi.mocked(listTeamHistory).mockReturnValue([]);
});

describe('chargement de la section Équipes', () => {
	it('ne prépare aucune donnée de gestion pour un joueur', async () => {
		vi.mocked(listSchedule).mockReturnValue([summary('next', '2099-01-05')]);
		vi.mocked(getGame).mockReturnValue(gameView('next', '2099-01-05', 'scheduled'));

		const data = (await run(player, { id: 'next' })) as {
			canManage: boolean;
			intelligence: unknown;
			ownTeam: string | null;
			isNext: boolean;
			isPastGame: boolean;
		};

		expect(data.canManage).toBe(false);
		expect(data.intelligence).toBeNull();
		expect(data.ownTeam).toBe('black');
		expect(data.isNext).toBe(true);
		expect(data.isPastGame).toBe(false);
		expect(lineupIntelligence).not.toHaveBeenCalled();
	});

	it('donne l’intelligence au gestionnaire', async () => {
		vi.mocked(listSchedule).mockReturnValue([summary('next', '2099-01-05')]);
		vi.mocked(getGame).mockReturnValue(gameView('next', '2099-01-05', 'scheduled'));
		vi.mocked(lineupIntelligence).mockReturnValue(intelligence);

		const data = (await run(manager, { id: 'next' })) as {
			canManage: boolean;
			intelligence: unknown;
		};

		expect(data.canManage).toBe(true);
		expect(data.intelligence).toEqual(intelligence);
		expect(lineupIntelligence).toHaveBeenCalledWith(
			manager,
			expect.objectContaining({ id: 'next' })
		);
	});

	it('borne l’historique et signale les matchs plus anciens', async () => {
		const past = Array.from({ length: TEAM_SECTION.historyLimit + 3 }, (_, index) =>
			summary(`past-${index}`, `2020-01-${String(28 - index).padStart(2, '0')}`, 'completed')
		);
		vi.mocked(listSchedule).mockReturnValue([summary('next', '2099-01-05'), ...past]);
		vi.mocked(getGame).mockReturnValue(gameView('next', '2099-01-05', 'scheduled'));
		vi.mocked(listTeamHistory).mockImplementation((_actor, ids) =>
			ids.map((id, index) => historyEntry(id, `2020-01-${String(28 - index).padStart(2, '0')}`))
		);

		const data = (await run(player, { id: 'next' })) as {
			history: TeamHistoryEntry[];
			hasMoreHistory: boolean;
		};

		expect(listTeamHistory).toHaveBeenCalledTimes(1);
		expect(vi.mocked(listTeamHistory).mock.calls[0][1]).toHaveLength(
			TEAM_SECTION.historyLimit
		);
		expect(data.history).toHaveLength(TEAM_SECTION.historyLimit);
		expect(data.hasMoreHistory).toBe(true);
	});

	it('distingue un match passé du prochain match', async () => {
		vi.mocked(listSchedule).mockReturnValue([
			summary('past', '2020-01-05', 'completed'),
			summary('next', '2099-01-05')
		]);
		vi.mocked(getGame).mockReturnValue(gameView('past', '2020-01-05', 'completed'));

		const data = (await run(player, { id: 'past' })) as {
			isNext: boolean;
			isPastGame: boolean;
			nextGameId: string | null;
		};

		expect(data.isNext).toBe(false);
		expect(data.isPastGame).toBe(true);
		expect(data.nextGameId).toBe('next');
	});

	it('refuse un match absent du calendrier', async () => {
		vi.mocked(listSchedule).mockReturnValue([summary('other', '2099-01-05')]);

		try {
			await run(player, { id: 'missing' });
			throw new Error('Aucune erreur reçue');
		} catch (error) {
			expect(isHttpError(error, 404)).toBe(true);
		}
	});

	it('ne lit rien pour un compte sans session', async () => {
		const data = (await run({ kind: 'anonymous' }, { id: 'next' })) as {
			game: unknown;
			history: unknown[];
		};

		expect(data.game).toBeNull();
		expect(data.history).toEqual([]);
		expect(listSchedule).not.toHaveBeenCalled();
	});
});
