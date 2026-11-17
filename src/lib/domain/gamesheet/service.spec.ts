import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Position } from '#config/positions.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import type { Team } from '#config/teams.ts';

const h = vi.hoisted(() => ({
	now: Date.UTC(2026, 10, 16, 18, 0)
}));

vi.mock('#lib/shared/time/clock.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/shared/time/clock.ts')>();
	return {
		...actual,
		clock: { nowMs: () => h.now }
	};
});

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
const {
	addGoal,
	addPenalty,
	deleteGoal,
	deletePenalty,
	finalizeGame,
	getGameSheet,
	updateGoal,
	updatePenalty
} = await import('./service.ts');
const { deletePlayerAccount } = await import('#lib/domain/players/queries.ts');
const { cancelRequestByAdmin } = await import('#lib/domain/subs/service.ts');
const { getGame } = await import('#lib/domain/games/service.ts');

const manager: Actor = {
	kind: 'user', active: true,
	userId: 'manager',
	name: 'Gérant',
	role: 'manager'
};

const playerActor: Actor = {
	kind: 'user', active: true,
	userId: 'viewer',
	name: 'Membre',
	role: 'player'
};

const admin: Actor = {
	kind: 'user', active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

const TEMPLATE = JSON.stringify({
	goaliesPerTeam: 0,
	forwardsPerTeam: 2,
	defensePerTeam: 0
});

const SNAPSHOT = JSON.stringify({
	skillDiff: 0,
	ageDiff: 0,
	sizeDiff: 0,
	warnings: [],
	ruleViolations: [],
	bench: [],
	candidateKey: '',
	generatedAt: 1
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
	jerseyNumber: number
): void {
	addUser(id, 'player');
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, jersey_number, is_substitute, active, created_at, updated_at)
			 values (?, ?, 'Test', ?, 30, ?, 0, 1, 0, 0)`
		)
		.run(id, id, position, jerseyNumber);
}

function addGame(
	id: string,
	status: 'scheduled' | 'cancelled' | 'completed',
	gameDate: string
): void {
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, completed_at,
			  roster_template_json, generated_at, generation_json, created_at, updated_at)
			 values (?, ?, '09:00', 'arena', 'Aréna', ?, ?, ?, null, null, 0, 0)`
		)
		.run(
			id,
			gameDate,
			status,
			status === 'completed' ? 1 : null,
			TEMPLATE
		);
}

function addSlot(
	gameId: string,
	team: Team,
	slotIndex: number,
	playerId: string
): void {
	sqlite
		.prepare(
			`insert into game_slots
			 (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values (?, ?, ?, 'forward', ?, ?, 'regular', 0, 0)`
		)
		.run(`${gameId}:${team}:${slotIndex}`, gameId, team, slotIndex, playerId);
	sqlite
		.prepare(
			`insert into game_availability (game_id, player_id, status, updated_at)
			 values (?, ?, 'present', 0)
			 on conflict (game_id, player_id) do update set status = 'present'`
		)
		.run(gameId, playerId);
	sqlite
		.prepare(
			'update games set generated_at = 1, generation_json = ? where id = ?'
		)
		.run(SNAPSHOT, gameId);
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
		'player_ratings',
		'pair_rules',
		'sub_requests',
		'sub_profiles',
		'audit_log',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}

	addUser('admin', 'admin');
	addUser('manager', 'manager');
	addUser('viewer', 'player');
	addPlayer('a', 'forward', 9);
	addPlayer('b', 'forward', 11);
	addPlayer('c', 'forward', 19);
	addPlayer('d', 'forward', 21);
	addPlayer('e', 'forward', 5);

	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at)
			 values ('arena', 'Aréna', 0, 0)`
		)
		.run();

	addGame('started', 'scheduled', '2026-11-16');
	addGame('future', 'scheduled', '2026-11-20');
	addGame('past', 'completed', '2026-11-10');
	addGame('cancelled', 'cancelled', '2026-11-15');

	for (const gameId of ['started', 'future', 'past']) {
		addSlot(gameId, 'white', 0, 'a');
		addSlot(gameId, 'white', 1, 'b');
		addSlot(gameId, 'black', 0, 'c');
		addSlot(gameId, 'black', 1, 'd');
	}
});

describe('feuille de match', () => {
	it('ajoute, modifie et supprime un but avec ses totaux', () => {
		const created = addGoal(manager, 'started', {
			team: 'white',
			period: 1,
			clock: '12:34',
			kind: 'even',
			scorerPlayerId: 'a',
			assist1PlayerId: 'b',
			assist2PlayerId: null
		});

		expect(created.scorer).toMatchObject({
			playerId: 'a',
			fullName: 'a Test',
			jerseyNumber: 9,
			team: 'white'
		});
		expect(created.assists.map((assist) => assist.playerId)).toEqual(['b']);

		let sheet = getGameSheet(playerActor, 'started');
		expect(sheet.score).toEqual({ white: 1, black: 0 });
		expect(
			sheet.totals.find((entry) => entry.playerId === 'a')
		).toMatchObject({ goals: 1, assists: 0, points: 1 });
		expect(
			sheet.totals.find((entry) => entry.playerId === 'b')
		).toMatchObject({ goals: 0, assists: 1, points: 1 });

		const updated = updateGoal(manager, 'started', created.id, {
			team: 'white',
			period: 2,
			clock: '08:00',
			kind: 'power_play',
			scorerPlayerId: 'b',
			assist1PlayerId: null,
			assist2PlayerId: null
		});
		expect(updated).toMatchObject({ period: 2, clock: '08:00', kind: 'power_play' });
		sheet = getGameSheet(playerActor, 'started');
		expect(
			sheet.totals.find((entry) => entry.playerId === 'a')
		).toMatchObject({ goals: 0, assists: 0 });
		expect(
			sheet.totals.find((entry) => entry.playerId === 'b')
		).toMatchObject({ goals: 1, assists: 0 });

		deleteGoal(manager, 'started', created.id);
		expect(getGameSheet(playerActor, 'started').goals).toEqual([]);

		const actions = sqlite
			.prepare("select action from audit_log where entity_id = 'started' order by created_at")
			.all() as { action: string }[];
		expect(actions.map((row) => row.action)).toEqual([
			'game.goal_added',
			'game.goal_updated',
			'game.goal_deleted'
		]);
	});

	it('accepte au plus deux aides, dans l’ordre', () => {
		addPlayer('f', 'forward', 13);
		addSlot('started', 'white', 2, 'f');
		const error = captureError(() =>
			addGoal(manager, 'started', {
				team: 'white',
				period: 1,
				clock: '10:00',
				kind: 'even',
				scorerPlayerId: 'a',
				assist1PlayerId: null,
				assist2PlayerId: 'b'
			})
		);
		expect(error).toMatchObject({ code: 'VALIDATION' });

		const goal = addGoal(manager, 'started', {
			team: 'white',
			period: 1,
			clock: '10:00',
			kind: 'even',
			scorerPlayerId: 'a',
			assist1PlayerId: 'b',
			assist2PlayerId: 'f'
		});
		expect(goal.assists.map((assist) => assist.playerId)).toEqual(['b', 'f']);
	});

	it('refuse une aide de l’autre équipe, le buteur non habillé et son nom en double', () => {
		expect(
			captureError(() =>
				addGoal(manager, 'started', {
					team: 'white',
					period: 1,
					clock: '10:00',
					kind: 'even',
					scorerPlayerId: 'a',
					assist1PlayerId: 'c'
				})
			)
		).toMatchObject({ code: 'VALIDATION', key: 'gamesheet.assistNotDressed' });

		expect(
			captureError(() =>
				addGoal(manager, 'started', {
					team: 'white',
					period: 1,
					clock: '10:00',
					kind: 'even',
					scorerPlayerId: 'e'
				})
			)
		).toMatchObject({ code: 'VALIDATION', key: 'gamesheet.scorerNotDressed' });

		expect(
			captureError(() =>
				addGoal(manager, 'started', {
					team: 'white',
					period: 1,
					clock: '10:00',
					kind: 'even',
					scorerPlayerId: 'a',
					assist1PlayerId: 'a'
				})
			)
		).toMatchObject({ code: 'VALIDATION', key: 'gamesheet.assistIsScorer' });
	});

	it('refuse un tir de punition avec une aide', () => {
		expect(
			captureError(() =>
				addGoal(manager, 'started', {
					team: 'white',
					period: 1,
					clock: '10:00',
					kind: 'penalty_shot',
					scorerPlayerId: 'a',
					assist1PlayerId: 'b'
				})
			)
		).toMatchObject({ code: 'VALIDATION' });
	});

	it('refuse un but avant le début du match et accepte la correction après', () => {
		expect(
			captureError(() =>
				addGoal(manager, 'future', {
					team: 'white',
					period: 1,
					clock: '10:00',
					kind: 'even',
					scorerPlayerId: 'a'
				})
			)
		).toMatchObject({ code: 'CONFLICT', key: 'games.notStarted' });

		const corrected = addGoal(manager, 'past', {
			team: 'white',
			period: 3,
			clock: '02:00',
			kind: 'even',
			scorerPlayerId: 'a'
		});
		expect(corrected.id).toBeTruthy();
		const audit = sqlite
			.prepare(
				"select metadata_json from audit_log where action = 'game.goal_added' and entity_id = 'past'"
			)
			.get() as { metadata_json: string };
		expect(JSON.parse(audit.metadata_json)).toMatchObject({ corrected: true });
	});

	it('refuse un but dans un match annulé', () => {
		expect(
			captureError(() =>
				addGoal(manager, 'cancelled', {
					team: 'white',
					period: 1,
					clock: '10:00',
					kind: 'even',
					scorerPlayerId: 'a'
				})
			)
		).toMatchObject({ code: 'CONFLICT', key: 'gamesheet.cancelled' });
	});
});

describe('pénalités', () => {
	it('refuse la feuille d’un match qui n’a pas d’alignement', () => {
		addGame('ungenerated', 'scheduled', '2026-11-14');

		expect(
			captureError(() =>
				addGoal(manager, 'ungenerated', {
					team: 'white',
					period: 1,
					clock: '10:00',
					kind: 'even',
					scorerPlayerId: 'a',
					assist1PlayerId: null,
					assist2PlayerId: null
				})
			)
		).toMatchObject({ code: 'CONFLICT', key: 'games.notStarted' });
	});

	it('ajoute, modifie et supprime une pénalité', () => {
		const penalty = addPenalty(manager, 'started', {
			team: 'white',
			period: 1,
			clock: '07:15',
			playerId: 'a',
			infraction: 'accrochage',
			minutes: 2,
			coincidental: false
		});
		expect(penalty.player).toMatchObject({ playerId: 'a', jerseyNumber: 9 });
		expect(
			getGameSheet(playerActor, 'started').totals.find(
				(entry) => entry.playerId === 'a'
			)?.penaltyMinutes
		).toBe(2);

		updatePenalty(manager, 'started', penalty.id, {
			team: 'white',
			period: 2,
			clock: '04:00',
			playerId: 'b',
			infraction: 'baton_eleve',
			minutes: 4,
			coincidental: true
		});
		expect(
			getGameSheet(playerActor, 'started').totals.find(
				(entry) => entry.playerId === 'b'
			)
		).toMatchObject({ penaltyMinutes: 4 });

		deletePenalty(manager, 'started', penalty.id);
		expect(getGameSheet(playerActor, 'started').penalties).toEqual([]);
	});

	it('refuse un joueur non habillé, une infraction et des minutes invalides', () => {
		expect(
			captureError(() =>
				addPenalty(manager, 'started', {
					team: 'white',
					period: 1,
					clock: '07:15',
					playerId: 'e',
					infraction: 'accrochage',
					minutes: 2,
					coincidental: false
				})
			)
		).toMatchObject({
			code: 'VALIDATION',
			key: 'gamesheet.penaltyPlayerNotDressed'
		});

		expect(
			captureError(() =>
				addPenalty(manager, 'started', {
					team: 'white',
					period: 1,
					clock: '07:15',
					playerId: 'a',
					infraction: 'inconnue',
					minutes: 2,
					coincidental: false
				})
			)
		).toMatchObject({ code: 'VALIDATION' });

		expect(
			captureError(() =>
				addPenalty(manager, 'started', {
					team: 'white',
					period: 1,
					clock: '07:15',
					playerId: 'a',
					infraction: 'accrochage',
					minutes: 3,
					coincidental: false
				})
			)
		).toMatchObject({ code: 'VALIDATION' });
	});
});

describe('score et totaux', () => {
	it('refuse un but contre son camp dont le buteur est du camp crédité', () => {
		const error = captureError(() =>
			addGoal(manager, 'started', {
				team: 'white',
				period: 1,
				clock: '05:00',
				kind: 'own_goal',
				scorerPlayerId: 'a'
			})
		);

		expect(error).toMatchObject({
			code: 'VALIDATION',
			key: 'gamesheet.scorerNotDressed'
		});
		expect(getGameSheet(playerActor, 'started').score).toEqual({
			white: 0,
			black: 0
		});
	});

	it('accepte deux joueurs du même nom comme buteur et aide', () => {
		addPlayer('jumeau1', 'forward', 30);
		addPlayer('jumeau2', 'forward', 31);
		sqlite
			.prepare(
				"update players set first_name = 'Alex', last_name = 'Tremblay' where user_id in ('jumeau1', 'jumeau2')"
			)
			.run();
		addSlot('started', 'white', 2, 'jumeau1');
		addSlot('started', 'white', 3, 'jumeau2');

		const goal = addGoal(manager, 'started', {
			team: 'white',
			period: 1,
			clock: '04:00',
			kind: 'even',
			scorerPlayerId: 'jumeau1',
			assist1PlayerId: 'jumeau2'
		});

		expect(goal.scorer).toMatchObject({
			playerId: 'jumeau1',
			fullName: 'Alex Tremblay'
		});
		expect(goal.assists[0]).toMatchObject({
			playerId: 'jumeau2',
			fullName: 'Alex Tremblay'
		});
	});

	it('compte les buts contre son camp pour l’équipe créditée et remplit les joueurs habillés', () => {
		addGoal(manager, 'started', {
			team: 'white',
			period: 1,
			clock: '15:00',
			kind: 'even',
			scorerPlayerId: 'a',
			assist1PlayerId: 'b'
		});
		addGoal(manager, 'started', {
			team: 'white',
			period: 2,
			clock: '09:00',
			kind: 'own_goal',
			scorerPlayerId: 'c'
		});
		addGoal(manager, 'started', {
			team: 'black',
			period: 3,
			clock: '01:00',
			kind: 'short_handed',
			scorerPlayerId: 'c'
		});
		addPenalty(manager, 'started', {
			team: 'white',
			period: 1,
			clock: '12:00',
			playerId: 'a',
			infraction: 'accrochage',
			minutes: 2,
			coincidental: false
		});
		addPenalty(manager, 'started', {
			team: 'white',
			period: 1,
			clock: '11:00',
			playerId: 'b',
			infraction: 'baton_eleve',
			minutes: 4,
			coincidental: false
		});
		addPenalty(manager, 'started', {
			team: 'black',
			period: 2,
			clock: '08:00',
			playerId: 'c',
			infraction: 'inconduite',
			minutes: 10,
			coincidental: true
		});

		const sheet = getGameSheet(playerActor, 'started');

		expect(sheet.score).toEqual({ white: 2, black: 1 });
		expect(sheet.goals.find((goal) => goal.kind === 'own_goal')).toMatchObject({
			ownGoal: true,
			penaltyShot: false,
			team: 'white',
			scorer: { playerId: 'c', team: 'black' }
		});
		expect(sheet.totals).toEqual([
			{
				playerId: 'a',
				fullName: 'a Test',
				jerseyNumber: 9,
				team: 'white',
				goals: 1,
				assists: 0,
				points: 1,
				penaltyMinutes: 2
			},
			{
				playerId: 'b',
				fullName: 'b Test',
				jerseyNumber: 11,
				team: 'white',
				goals: 0,
				assists: 1,
				points: 1,
				penaltyMinutes: 4
			},
			{
				playerId: 'c',
				fullName: 'c Test',
				jerseyNumber: 19,
				team: 'black',
				goals: 1,
				assists: 0,
				points: 1,
				penaltyMinutes: 10
			},
			{
				playerId: 'd',
				fullName: 'd Test',
				jerseyNumber: 21,
				team: 'black',
				goals: 0,
				assists: 0,
				points: 0,
				penaltyMinutes: 0
			}
		]);
	});

	it('garde le nom et le numéro figés après la suppression du joueur', () => {
		addGoal(manager, 'started', {
			team: 'white',
			period: 1,
			clock: '15:00',
			kind: 'even',
			scorerPlayerId: 'a',
			assist1PlayerId: 'b'
		});

		deletePlayerAccount('a', '2026-11-16', '00:00');

		const sheet = getGameSheet(playerActor, 'started');
		expect(sheet.goals[0].scorer).toEqual({
			playerId: '',
			fullName: 'a Test',
			jerseyNumber: 9,
			team: 'white'
		});
		expect(sheet.score.white).toBe(1);
		expect(
			sheet.totals.find((entry) => entry.playerId === 'b')
		).toMatchObject({ assists: 1, points: 1 });
	});
});

describe('finalisation', () => {
	it('refuse un membre ordinaire', () => {
		expect(captureError(() => finalizeGame(playerActor, 'started'))).toMatchObject({
			code: 'FORBIDDEN'
		});
	});

	it('refuse un match non commencé, annulé ou déjà terminé', () => {
		expect(captureError(() => finalizeGame(manager, 'future'))).toMatchObject({
			code: 'CONFLICT',
			key: 'games.notStarted'
		});
		expect(captureError(() => finalizeGame(manager, 'cancelled'))).toMatchObject({
			code: 'CONFLICT',
			key: 'games.cannotFinalizeCancelled'
		});
		expect(captureError(() => finalizeGame(manager, 'past'))).toMatchObject({
			code: 'CONFLICT',
			key: 'games.alreadyCompleted'
		});
	});

	it('termine un match commencé, date la fin et audite le geste', () => {
		finalizeGame(admin, 'started');

		const row = sqlite
			.prepare('select status, completed_at from games where id = ?')
			.get('started') as { status: string; completed_at: number };
		expect(row).toEqual({ status: 'completed', completed_at: h.now });
		expect(getGameSheet(playerActor, 'started').finalized).toBe(true);
		const audit = sqlite
			.prepare(
				"select count(*) as count from audit_log where action = 'game.finalized' and entity_id = 'started'"
			)
			.get() as { count: number };
		expect(audit.count).toBe(1);
	});

	it('refuse d’annuler une demande après le début du match', () => {
		sqlite
			.prepare(
				`insert into sub_requests
				 (id, game_id, requested_by_player_id, created_by_user_id, position, reason,
				  status, created_at, filled_by_player_id, filled_at, cancelled_at)
				 values ('open', 'started', 'a', null, 'forward', 'manual', 'open', 0, null, null, null)`
			)
			.run();

		expect(
			captureError(() =>
				cancelRequestByAdmin(manager, getGame(manager, 'started'), 'open')
			)
		).toMatchObject({ code: 'CONFLICT', key: 'subs.requestNotActive' });
		const row = sqlite
			.prepare("select status from sub_requests where id = 'open'")
			.get() as { status: string };
		expect(row.status).toBe('open');
	});

	it('ferme les demandes ouvertes et comblées dans la transaction', () => {
		sqlite
			.prepare(
				`insert into sub_requests
				 (id, game_id, requested_by_player_id, created_by_user_id, position, reason,
				  status, created_at, filled_by_player_id, filled_at, cancelled_at)
				 values
				 ('open', 'started', 'b', null, 'forward', 'manual', 'open', 0, null, null, null),
				 ('filled', 'started', null, null, 'forward', 'manual', 'filled', 0, 'a', 0, null)`
			)
			.run();

		finalizeGame(manager, 'started');

		const remaining = sqlite
			.prepare(
				"select count(*) as count from sub_requests where game_id = 'started' and status in ('open', 'filled')"
			)
			.get() as { count: number };
		expect(remaining.count).toBe(0);
		const audit = sqlite
			.prepare(
				"select metadata_json from audit_log where action = 'sub.requests_cancelled' and entity_id = 'started'"
			)
			.get() as { metadata_json: string } | undefined;
		expect(JSON.parse(audit?.metadata_json ?? '{}')).toEqual({
			count: 2,
			reason: 'finalized'
		});
	});
});
