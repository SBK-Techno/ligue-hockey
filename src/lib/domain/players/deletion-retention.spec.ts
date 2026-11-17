import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

/**
 * La suppression d'un compte n'efface plus son histoire : le grand livre, les
 * places jouées et les buts restent, la fiche devient un nom neutre et les
 * évaluations disparaissent. Aucune surface ne réécrit cette règle à la lecture.
 */

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
const { deletePlayerAccount } = await import('./queries.ts');
const { getGame } = await import('#lib/domain/games/service.ts');
const { getGameSheet: readSheet } = await import('#lib/domain/gamesheet/service.ts');

const manager: Actor = {
	kind: 'user',
	active: true,
	userId: 'manager',
	name: 'Gérant',
	role: 'manager'
};

const TEMPLATE = JSON.stringify({
	goaliesPerTeam: 0,
	forwardsPerTeam: 1,
	defensePerTeam: 0
});

const SNAPSHOT = JSON.stringify({
	skillDiff: null,
	ageDiff: 0,
	sizeDiff: 0,
	warnings: [],
	ruleViolations: [],
	bench: [],
	candidateKey: 'test',
	generatedAt: 1
});

beforeEach(() => {
	for (const table of [
		'player_ratings',
		'game_player_ratings',
		'game_goals',
		'game_penalties',
		'game_slots',
		'game_availability',
		'payments',
		'payment_plans',
		'games',
		'locations',
		'players',
		'audit_log',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}

	for (const [id, role] of [
		['manager', 'manager'],
		['victim', 'player']
	]) {
		sqlite
			.prepare(
				`insert into user (id, name, email, email_verified, created_at, updated_at, role)
				 values (?, ?, ?, 1, 0, 0, ?)`
			)
			.run(id, id, `${id}@example.test`, role);
	}
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, jersey_number, avatar_id, active, created_at, updated_at)
			 values ('victim', 'Victime', 'Test', 'forward', 30, 22, 'capitaine-navy', 1, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at)
			 values ('arena', 'Aréna', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, completed_at,
			  roster_template_json, generated_at, generation_json, created_at, updated_at)
			 values ('past', '2026-11-01', '09:00', 'arena', 'Aréna', 'completed', 1, ?, 1, ?, 0, 0)`
		)
		.run(TEMPLATE, SNAPSHOT);
	sqlite
		.prepare(
			`insert into game_slots
			 (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values ('slot', 'past', 'white', 'forward', 0, 'victim', 'regular', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into game_goals
			 (id, game_id, team, period, clock, kind, scorer_player_id, scorer_name, scorer_number,
			  assist1_player_id, assist1_name, assist1_number, assist2_player_id, assist2_name,
			  created_at, updated_at)
			 values ('goal', 'past', 'white', 1, '10:00', 'even', 'victim', 'Victime Test', 22,
			         'victim', 'Victime Test', 22, null, 'Autre Joueur', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into game_penalties
			 (id, game_id, team, period, clock, player_id, player_name, player_number,
			  infraction, minutes, coincidental, created_at, updated_at)
			 values ('penalty', 'past', 'white', 1, '12:00', 'victim', 'Victime Test', 22,
			         'trebucher', 2, 0, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into player_ratings (player_id, attribute, value, updated_at)
			 values ('victim', 'passing', 4, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into game_player_ratings (game_id, player_id, attribute, value, updated_at)
			 values ('past', 'victim', 'impact', 4, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into payments (id, player_id, amount_cents, paid_at, method, created_at)
			 values ('payment', 'victim', 5000, '2026-11-01', 'cash', 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into payment_plans
			 (id, player_id, total_cents, first_cents, second_cents, created_at, updated_at)
			 values ('plan', 'victim', 5000, 2500, 2500, 0, 0)`
		)
		.run();
});

describe('rétention d’une suppression de joueur', () => {
	it('garde le grand livre, la place jouée et les buts', () => {
		deletePlayerAccount('victim', '2026-11-17', '12:00');

		expect(
			sqlite.prepare("select count(*) as count from payments where id = 'payment'").get()
		).toEqual({ count: 1 });
		expect(
			sqlite.prepare("select count(*) as count from payment_plans where id = 'plan'").get()
		).toEqual({ count: 1 });
		expect(
			sqlite
				.prepare("select assigned_player_id from game_slots where id = 'slot'")
				.get()
		).toEqual({ assigned_player_id: 'victim' });
		expect(
			sqlite.prepare("select scorer_player_id, assist1_player_id from game_goals where id = 'goal'").get()
		).toEqual({ scorer_player_id: 'victim', assist1_player_id: 'victim' });
		expect(
			sqlite.prepare("select player_id from game_penalties where id = 'penalty'").get()
		).toEqual({ player_id: 'victim' });
	});

	it('rend un nom neutre sur la feuille et ne laisse aucune note', () => {
		deletePlayerAccount('victim', '2026-11-17', '12:00');

		const sheet = readSheet(manager, 'past');
		const goal = sheet.goals[0]!;

		expect(goal.scorer!.fullName).toBe('Joueur retiré');
		expect(goal.assists.map((entry) => entry.fullName)).toEqual([
			'Joueur retiré',
			'Autre Joueur'
		]);
		expect(sheet.penalties[0]!.player.fullName).toBe('Joueur retiré');
		expect(JSON.stringify(sheet)).not.toContain('Victime');
		expect(
			sqlite.prepare('select count(*) as count from player_ratings').get()
		).toEqual({ count: 0 });
		expect(
			sqlite.prepare('select count(*) as count from game_player_ratings').get()
		).toEqual({ count: 0 });
	});

	it('garde le nom neutre dans la fiche et jamais l’ancien', () => {
		deletePlayerAccount('victim', '2026-11-17', '12:00');

		const view = getGame(manager, 'past');

		expect(view.slots[0]?.player?.fullName).toBe('Joueur retiré');
		expect(
			view.slots.every((slot) => slot.player === null || slot.player.fullName !== 'victim')
		).toBe(true);
		expect(JSON.stringify(view)).not.toContain('"fullName":"victim"');
		expect(JSON.stringify(view)).not.toContain('Victime');
	});
});
