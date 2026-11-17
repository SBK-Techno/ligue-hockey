import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Un match terminé garde les joueurs qui ont réellement joué, même si leur
 * compte a été désactivé depuis. Un match à venir, lui, ne montre que le
 * bassin vivant. Ce test traverse les deux projections qui exposent des
 * participants : le banc de l'instantané et la feuille de présence.
 */

const h = vi.hoisted(() => ({
	now: Date.UTC(2026, 10, 16, 18, 0),
	settings: {
		'roster.goaliesPerTeam': 1,
		'roster.forwardsPerTeam': 2,
		'roster.defensePerTeam': 2,
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
	return { ...actual, clock: { nowMs: () => h.now } };
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
const { getGame } = await import('./service.ts');
const { getAvailability } = await import('#lib/domain/availability/service.ts');

const NOW = 1_700_000_000_000;

const manager = {
	kind: 'user' as const,
	active: true,
	userId: 'manager',
	name: 'Gérant',
	role: 'manager' as const
};

type GameState = {
	status: 'scheduled' | 'cancelled' | 'completed';
	gameDate: string;
};

function seed({ status, gameDate }: GameState): void {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('manager', 'Gérant', 'manager@example.test', 1, ?, ?, 'manager')`
		)
		.run(NOW, NOW);
	for (const id of ['alice', 'bob']) {
		sqlite
			.prepare(
				`insert into user (id, name, email, email_verified, created_at, updated_at, role)
				 values (?, ?, ?, 1, ?, ?, 'player')`
			)
			.run(id, id, `${id}@example.test`, NOW, NOW);
	}
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, avatar_id, active, created_at, updated_at)
			 values ('alice', 'Alice', 'A', 'forward', 30, 'capitaine-navy', 1, ?, ?)`
		)
		.run(NOW, NOW);
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, avatar_id, active, created_at, updated_at)
			 values ('bob', 'Bob', 'B', 'defense', 30, 'capitaine-blanc', 0, ?, ?)`
		)
		.run(NOW, NOW);
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at)
			 values ('loc', 'Aréna', ?, ?)`
		)
		.run(NOW, NOW);
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, completed_at,
			  roster_template_json, generated_at, generation_json, created_at, updated_at)
			 values ('g1', ?, '09:00', 'loc', 'Aréna', ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			gameDate,
			status,
			status === 'completed' ? NOW : null,
			JSON.stringify({ goaliesPerTeam: 1, forwardsPerTeam: 2, defensePerTeam: 2 }),
			NOW,
			JSON.stringify({
				skillDiff: 0,
				ageDiff: 0,
				sizeDiff: 0,
				warnings: [],
				ruleViolations: [],
				bench: [{ playerId: 'bob', position: 'defense', kind: 'regular' }],
				candidateKey: 'candidate',
				generatedAt: NOW
			}),
			NOW,
			NOW
		);
	sqlite
		.prepare(
			`insert into game_slots
			 (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values ('slot-1', 'g1', 'white', 'defense', 0, 'bob', 'regular', ?, ?)`
		)
		.run(NOW, NOW);
	sqlite
		.prepare(
			`insert into game_availability (game_id, player_id, status, updated_at)
			 values ('g1', 'bob', 'present', ?)`
		)
		.run(NOW);
}

beforeEach(() => {
	for (const table of [
		'game_availability',
		'game_slots',
		'games',
		'locations',
		'players',
		'audit_log',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
});

describe('participants d’un match selon son état', () => {
	it.each<[string, GameState, boolean]>([
		['terminé', { status: 'completed', gameDate: '2026-11-01' }, true],
		['commencé hier', { status: 'scheduled', gameDate: '2026-11-15' }, true],
		['à venir demain', { status: 'scheduled', gameDate: '2026-11-17' }, false],
		['annulé demain', { status: 'cancelled', gameDate: '2026-11-17' }, false]
	])('%s : participant visible = %s', (_label, state, visible) => {
		seed(state);

		const game = getGame(manager, 'g1');
		const availability = getAvailability(manager, 'g1');

		expect(game.generation?.bench.map((entry) => entry.playerId)).toEqual(
			visible ? ['bob'] : []
		);
		expect(availability.rows.map((row) => row.playerId)).toEqual(
			visible ? ['bob'] : []
		);
	});
});
