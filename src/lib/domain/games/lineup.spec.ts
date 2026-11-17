import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Position } from '#config/positions.ts';
import { RATING_ATTRIBUTE_KEYS, GAME_RATING_KEYS } from '#config/rating-attributes.ts';
import { buildSlotDefinitions } from '#config/roster.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import type { ManualLineupInput } from './validators.ts';

const h = vi.hoisted(() => ({
	now: Date.UTC(2026, 10, 16, 18, 0),
	settings: {
		'roster.goaliesPerTeam': 0,
		'roster.forwardsPerTeam': 2,
		'roster.defensePerTeam': 0,
		'teams.skillTolerance': 0.25,
		'teams.maxPlayers': 24,
		'teams.maxSkillSpread': 0,
		'teams.maxAgeSpread': 0,
		'teams.maxSizeSpread': 0,
		'games.availabilityClosesHours': 24,
		'notifications.subRequestOnAbsence': false
	}
}));

vi.mock('#lib/shared/time/clock.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/shared/time/clock.ts')>();
	return {
		...actual,
		clock: { nowMs: () => h.now }
	};
});

vi.mock('#lib/domain/settings/service.ts', () => ({
	getSettings: () => h.settings
}));

vi.mock('#lib/server/db/index.ts', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite);
	migrate(db, { migrationsFolder: 'drizzle' });
	return { db, sqlite };
});

const { sqlite } = await import('#lib/server/db/index.ts');
const { saveManualLineup } = await import('./lineup.ts');
const { getGame, regenerateAsAdmin } = await import('./service.ts');
const { regenerateIfGenerated } = await import('./service.ts');
const { markAvailability } = await import('#lib/domain/availability/service.ts');
const { fillOpenSlots } = await import('./alignment.ts');
const { addGoal } = await import('#lib/domain/gamesheet/service.ts');

const manager: Actor = {
	kind: 'user', active: true,
	userId: 'manager',
	name: 'Gérant',
	role: 'manager'
};

const admin: Actor = {
	kind: 'user', active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

const playerActor: Actor = {
	kind: 'user', active: true,
	userId: 'a',
	name: 'A',
	role: 'player'
};

const EMPTY_SNAPSHOT = {
	skillDiff: 0,
	ageDiff: 0,
	sizeDiff: 0,
	warnings: [] as string[],
	ruleViolations: [] as unknown[],
	bench: [] as unknown[],
	candidateKey: '',
	generatedAt: 1
};

const TEMPLATE = JSON.stringify({
	goaliesPerTeam: 0,
	forwardsPerTeam: 2,
	defensePerTeam: 0
});

const GOALIE_TEMPLATE = JSON.stringify({
	goaliesPerTeam: 1,
	forwardsPerTeam: 0,
	defensePerTeam: 1
});

function captureError(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	throw new Error('expected an error');
}

function addUser(id: string, role: 'player' | 'manager' | 'admin'): void {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values (?, ?, ?, 1, 0, 0, ?)`
		)
		.run(id, id, `${id}@example.test`, role);
}

function addPlayer(
	id: string,
	position: Position,
	options: { rating?: number } = {}
): void {
	addUser(id, 'player');
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, jersey_number, is_substitute, active, created_at, updated_at)
			 values (?, ?, 'Test', ?, 30, null, 0, 1, 0, 0)`
		)
		.run(id, id, position);
	const value = options.rating ?? 3;
	const statement = sqlite.prepare(
		`insert into player_ratings (player_id, attribute, value, updated_at)
		 values (?, ?, ?, 0)`
	);
	for (const attribute of RATING_ATTRIBUTE_KEYS) {
		statement.run(id, attribute, value);
	}
}

function addSubstitute(
	id: string,
	position: Position,
	positions: readonly Position[]
): void {
	addPlayer(id, position);
	sqlite
		.prepare("update players set is_substitute = 1 where user_id = ?")
		.run(id);
	sqlite
		.prepare(
			`insert into sub_profiles (player_id, favorite, positions_json, created_at, updated_at)
			 values (?, 0, ?, 0, 0)`
		)
		.run(id, JSON.stringify(positions));
	sqlite
		.prepare(
			`insert into sub_requests
			 (id, game_id, requested_by_player_id, created_by_user_id, position, reason,
			  status, created_at, filled_by_player_id, filled_at, cancelled_at)
			 values (?, 'game', null, null, ?, 'manual', 'filled', 0, ?, 0, null)`
		)
		.run(`claim-${id}`, position, id);
}

function addGame(
	id: string,
	gameDate = '2026-11-20',
	template = TEMPLATE
): void {
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, roster_template_json,
			  generated_at, generation_json, created_at, updated_at)
			 values (?, ?, '09:00', 'arena', 'Aréna', 'scheduled', ?, 1, ?, 0, 0)`
		)
		.run(id, gameDate, template, JSON.stringify(EMPTY_SNAPSHOT));
	for (const slot of buildSlotDefinitions(JSON.parse(template))) {
		sqlite
			.prepare(
				`insert into game_slots
				 (id, game_id, team, position, slot_index, created_at, updated_at)
				 values (?, ?, ?, ?, ?, 0, 0)`
			)
			.run(
				`${id}:${slot.team}:${slot.position}:${slot.index}`,
				id,
				slot.team,
				slot.position,
				slot.index
			);
	}
}

function setPresent(gameId: string, playerId: string, status = 'present'): void {
	sqlite
		.prepare(
			`insert into game_availability (game_id, player_id, status, updated_at)
			 values (?, ?, ?, 0)`
		)
		.run(gameId, playerId, status);
}

function addRule(
	aId: string,
	bId: string,
	kind: 'must' | 'must_not',
	strict: boolean
): void {
	const [first, second] = [aId, bId].sort();
	sqlite
		.prepare(
			`insert into pair_rules
			 (id, player_a_id, player_b_id, kind, strict, created_at, created_by)
			 values (?, ?, ?, ?, ?, 0, null)`
		)
		.run(`rule-${first}-${second}`, first, second, kind, strict ? 1 : 0);
}

function lineups(gameId: string): string[] {
	return (
		sqlite
			.prepare(
				`select team, position, slot_index, assigned_player_id
				 from game_slots where game_id = ? and assigned_player_id is not null
				 order by team, position, slot_index`
			)
			.all(gameId) as {
			team: string;
			position: string;
			slot_index: number;
			assigned_player_id: string;
		}[]
	).map(
		(row) =>
			`${row.team}:${row.position}:${row.slot_index}:${row.assigned_player_id}`
	);
}

function fullLineup(): ManualLineupInput {
	return {
		expectedGeneratedAt: 1,
		assignments: [
			{ team: 'white', position: 'forward', slotIndex: 0, playerId: 'a' },
			{ team: 'white', position: 'forward', slotIndex: 1, playerId: 'b' },
			{ team: 'black', position: 'forward', slotIndex: 0, playerId: 'c' },
			{ team: 'black', position: 'forward', slotIndex: 1, playerId: 'd' }
		]
	};
}

function withPlayers(
	players: readonly (string | null)[]
): ManualLineupInput {
	const line = fullLineup();
	return {
		expectedGeneratedAt: line.expectedGeneratedAt,
		assignments: line.assignments.map((assignment, index) => ({
			...assignment,
			playerId: players[index] ?? null
		}))
	};
}

function addGameRating(playerId: string): void {
	const statement = sqlite.prepare(
		`insert into game_player_ratings (game_id, player_id, attribute, value, updated_at)
		 values ('game', ?, ?, 3, 0)`
	);
	for (const attribute of GAME_RATING_KEYS) statement.run(playerId, attribute);
}

function ratedGamePlayers(): string[] {
	return (
		sqlite
			.prepare(
				"select distinct player_id from game_player_ratings where game_id = 'game' order by player_id"
			)
			.all() as { player_id: string }[]
	).map((row) => row.player_id);
}

beforeEach(() => {
	for (const table of [
		'game_goals',
		'game_penalties',
		'game_player_ratings',
		'game_slots',
		'game_availability',
		'games',
		'locations',
		'pair_rules',
		'sub_requests',
		'sub_profiles',
		'player_ratings',
		'audit_log',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}

	addUser('admin', 'admin');
	addUser('manager', 'manager');
	for (const id of ['a', 'b', 'c', 'd']) addPlayer(id, 'forward');
	addPlayer('e', 'defense');

	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at)
			 values ('arena', 'Aréna', 0, 0)`
		)
		.run();

	addGame('game');
	for (const id of ['a', 'b', 'c', 'd', 'e']) setPresent('game', id);
});

describe('alignement manuel', () => {
	it('refuse un acteur sans la capacité de gérer les matchs', () => {
		expect(captureError(() => saveManualLineup(playerActor, 'game', fullLineup()))).toMatchObject({
			code: 'FORBIDDEN'
		});
	});

	it('refuse un alignement manuel sur un match jamais généré', () => {
		sqlite
			.prepare(
				"update games set generated_at = null, generation_json = null where id = 'game'"
			)
			.run();

		expect(
			captureError(() => saveManualLineup(manager, 'game', fullLineup()))
		).toMatchObject({ code: 'CONFLICT', key: 'rating.gameNotGenerated' });
		expect(lineups('game')).toEqual([]);
	});

	it('enregistre l’alignement et marque la génération comme manuelle', () => {
		const view = saveManualLineup(manager, 'game', fullLineup());

		expect(view.lineupManualAt).toBe(h.now);
		expect(view.generation?.generatedAt).toBe(h.now);
		expect(lineups('game')).toEqual([
			'black:forward:0:c',
			'black:forward:1:d',
			'white:forward:0:a',
			'white:forward:1:b'
		]);
		const audit = sqlite
			.prepare(
				"select count(*) as count from audit_log where action = 'game.lineup_manual'"
			)
			.get() as { count: number };
		expect(audit.count).toBe(1);
	});

	it('refuse un jeton de génération périmé sans toucher aux places', () => {
		expect(
			captureError(() =>
				saveManualLineup(manager, 'game', {
					...fullLineup(),
					expectedGeneratedAt: 999
				})
			)
		).toMatchObject({ code: 'CONFLICT', key: 'games.lineupChanged' });
		expect(lineups('game')).toEqual([]);
		const row = sqlite
			.prepare('select lineup_manual_at from games where id = ?')
			.get('game') as { lineup_manual_at: number | null };
		expect(row.lineup_manual_at).toBeNull();
	});

	it('refuse un joueur absent, un poste incorrect et un doublon', () => {
		sqlite
			.prepare("delete from game_availability where game_id = 'game' and player_id = 'b'")
			.run();
		expect(
			captureError(() => saveManualLineup(manager, 'game', fullLineup()))
		).toMatchObject({ code: 'VALIDATION', key: 'games.lineupPlayerAbsent' });
		setPresent('game', 'b');

		expect(
			captureError(() =>
				saveManualLineup(manager, 'game', withPlayers(['e', 'b', 'c', 'd']))
			)
		).toMatchObject({ code: 'VALIDATION', key: 'games.lineupPositionInvalid' });

		expect(
			captureError(() =>
				saveManualLineup(manager, 'game', withPlayers(['a', 'a', 'c', 'd']))
			)
		).toMatchObject({ code: 'VALIDATION', key: 'games.lineupPlayerDuplicate' });
	});

	it('refuse un gardien dans une place de défenseur', () => {
		addPlayer('g', 'goalie');
		addGame('goalie-game', '2026-11-21', GOALIE_TEMPLATE);
		setPresent('goalie-game', 'g');
		setPresent('goalie-game', 'e');

		expect(
			captureError(() =>
				saveManualLineup(manager, 'goalie-game', {
					expectedGeneratedAt: 1,
					assignments: [
						{
							team: 'white',
							position: 'defense',
							slotIndex: 0,
							playerId: 'g'
						},
						{ team: 'white', position: 'goalie', slotIndex: 0, playerId: null },
						{ team: 'black', position: 'defense', slotIndex: 0, playerId: null },
						{ team: 'black', position: 'goalie', slotIndex: 0, playerId: null }
					]
				})
			)
		).toMatchObject({ code: 'VALIDATION', key: 'games.lineupPositionInvalid' });
		expect(lineups('goalie-game')).toEqual([]);
	});

	it('refuse une formation vide ou partielle au lieu d’effacer l’alignement', () => {
		saveManualLineup(manager, 'game', fullLineup());
		const before = lineups('game');

		for (const assignments of [[], fullLineup().assignments.slice(0, 3)]) {
			expect(
				captureError(() =>
					saveManualLineup(manager, 'game', {
						expectedGeneratedAt: h.now,
						assignments
					})
				)
			).toMatchObject({ code: 'VALIDATION', key: 'games.lineupIncomplete' });
		}
		expect(lineups('game')).toEqual(before);
	});

	it('efface toutes les places et purge toutes les notes sur une mise à blanc', () => {
		saveManualLineup(manager, 'game', fullLineup());
		addGameRating('a');
		addGameRating('b');

		const view = saveManualLineup(manager, 'game', {
			...withPlayers([null, null, null, null]),
			expectedGeneratedAt: h.now
		});

		expect(lineups('game')).toEqual([]);
		expect(view.openSlots).toBe(4);
		expect(ratedGamePlayers()).toEqual([]);
	});

	it('purge seulement les joueurs sortis de la glace et garde le banc', () => {
		saveManualLineup(manager, 'game', fullLineup());
		addGameRating('a');
		addGameRating('b');
		// e est présent au bassin mais n’a jamais été habillé : ses notes de
		// match ne doivent pas disparaître avec une écriture d’alignement.
		addGameRating('e');

		saveManualLineup(manager, 'game', {
			...withPlayers([null, 'b', 'c', 'd']),
			expectedGeneratedAt: h.now
		});

		expect(lineups('game')).toEqual([
			'black:forward:0:c',
			'black:forward:1:d',
			'white:forward:1:b'
		]);
		expect(ratedGamePlayers()).toEqual(['b', 'e']);
	});

	it('accepte un remplaçant réclamé selon les postes de son profil', () => {
		addSubstitute('s', 'forward', ['forward']);

		const view = saveManualLineup(manager, 'game', {
			expectedGeneratedAt: 1,
			assignments: [
				{ team: 'white', position: 'forward', slotIndex: 0, playerId: 's' },
				{ team: 'white', position: 'forward', slotIndex: 1, playerId: 'b' },
				{ team: 'black', position: 'forward', slotIndex: 0, playerId: 'c' },
				{ team: 'black', position: 'forward', slotIndex: 1, playerId: 'd' }
			]
		});

		expect(view.slots.find((slot) => slot.player?.playerId === 's')?.player?.kind).toBe(
			'sub'
		);
	});

	it('refuse une place qui n’existe pas dans le match', () => {
		expect(
			captureError(() =>
				saveManualLineup(manager, 'game', {
					...fullLineup(),
					assignments: [
						...fullLineup().assignments,
						{ team: 'white', position: 'forward', slotIndex: 2, playerId: 'a' }
					]
				})
			)
		).toMatchObject({ code: 'VALIDATION', key: 'games.lineupSlotUnknown' });
	});

	it('affiche le bassin vivant après un enregistrement manuel', () => {
		saveManualLineup(manager, 'game', fullLineup());
		sqlite
			.prepare(
				"update game_availability set status = 'absent' where game_id = 'game' and player_id = 'b'"
			)
			.run();
		addSubstitute('s', 'forward', ['forward']);

		const view = getGame(manager, 'game');
		const onIce = view.slots.flatMap((slot) =>
			slot.player ? [slot.player.playerId] : []
		);

		expect(onIce).not.toContain('b');
		expect(view.generation?.bench.map((entry) => entry.playerId)).toContain('s');
		expect(view.generation?.bench.map((entry) => entry.playerId)).not.toContain('b');
	});

	it('retire un joueur désisté de la glace, du banc et de la feuille', () => {
		saveManualLineup(manager, 'game', fullLineup());

		const result = markAvailability(playerActor, 'game', 'absent');

		expect(result.regenerated).toBe(false);
		let view = getGame(manager, 'game');
		expect(view.slots.flatMap((slot) => (slot.player ? [slot.player.playerId] : []))).not.toContain(
			'a'
		);
		expect(view.generation?.bench.map((entry) => entry.playerId)).not.toContain('a');
		expect(view.openSlots).toBe(1);
		expect(view.lineupComplete).toBe(false);

		// Au coup d'envoi, la vue figée garde ce qui a été publié : le joueur
		// retiré ne réapparaît pas et ne peut pas être crédité d'un but.
		sqlite.prepare("update games set game_date = '2020-01-05' where id = 'game'").run();
		view = getGame(manager, 'game');
		expect(view.slots.flatMap((slot) => (slot.player ? [slot.player.playerId] : []))).not.toContain(
			'a'
		);
		expect(
			captureError(() =>
				addGoal(manager, 'game', {
					team: 'white',
					period: 1,
					clock: '10:00',
					kind: 'even',
					scorerPlayerId: 'a',
					assist1PlayerId: null,
					assist2PlayerId: null
				})
			)
		).toMatchObject({ key: 'gamesheet.scorerNotDressed' });
	});

	it('ne republie jamais une place absente lors d’un comblement', () => {
		saveManualLineup(manager, 'game', fullLineup());
		addPlayer('f', 'forward');
		setPresent('game', 'f');
		// Une écriture ancienne peut avoir laissé le joueur sur la place : la
		// lecture du bassin vivant ne le republie pas et le comblement voit la
		// place ouverte.
		sqlite
			.prepare(
				"update game_availability set status = 'absent' where game_id = 'game' and player_id = 'a'"
			)
			.run();

		const before = getGame(manager, 'game');
		expect(before.slots.some((slot) => slot.player?.playerId === 'a')).toBe(false);
		expect(before.openSlots).toBe(1);

		const filled = fillOpenSlots(admin, 'game');

		expect(filled.filled).toBe(1);
		const after = getGame(manager, 'game');
		expect(after.slots.some((slot) => slot.player?.playerId === 'a')).toBe(false);
		expect(after.openSlots).toBe(0);
		expect(after.lineupComplete).toBe(true);
	});

	it('refuse une règle stricte en nommant la paire', () => {
		addRule('a', 'b', 'must_not', true);

		const error = captureError(() => saveManualLineup(manager, 'game', fullLineup()));

		expect(error).toMatchObject({
			code: 'VALIDATION',
			key: 'games.lineupRuleConflict',
			params: { a: 'a Test', b: 'b Test' },
			details: { kind: 'must_not', ruleId: 'rule-a-b' }
		});
		expect(lineups('game')).toEqual([]);
	});

	it('garde une préférence non stricte comme avertissement', () => {
		addRule('a', 'b', 'must_not', false);

		saveManualLineup(manager, 'game', fullLineup());

		const view = getGame(admin, 'game');
		expect(view.generation?.warnings).toContain('rule-preference');
	});

	it('résiste à un changement de présence automatique', () => {
		saveManualLineup(manager, 'game', fullLineup());
		const before = lineups('game');

		const result = markAvailability(playerActor, 'game', 'present');

		expect(result.regenerated).toBe(false);
		expect(regenerateIfGenerated('game')).toEqual({ regenerated: false });
		expect(lineups('game')).toEqual(before);
		const row = sqlite
			.prepare('select lineup_manual_at from games where id = ?')
			.get('game') as { lineup_manual_at: number };
		expect(row.lineup_manual_at).toBe(h.now);
	});

	it('efface le drapeau manuel lors d’une régénération explicite', () => {
		saveManualLineup(manager, 'game', fullLineup());

		regenerateAsAdmin(admin, 'game');

		const row = sqlite
			.prepare('select lineup_manual_at, generated_at from games where id = ?')
			.get('game') as { lineup_manual_at: number | null; generated_at: number };
		expect(row.lineup_manual_at).toBeNull();
		expect(row.generated_at).toBe(h.now);
	});
});
