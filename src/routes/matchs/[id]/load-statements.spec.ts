import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

/**
 * La fiche de match charge le match une seule fois : la feuille et la
 * présence reçoivent la vue déjà lue au lieu de relire la même ligne. Le
 * compteur observe les lectures réelles de `games` et `player_ratings`.
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
const { load: loadMatch } = await import('./+page.server.ts');
const { load: loadAdmin } = await import('../../admin/+page.server.ts');

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
	skillDiff: 0,
	ageDiff: 0,
	sizeDiff: 0,
	warnings: [],
	ruleViolations: [],
	bench: [],
	candidateKey: 'test',
	generatedAt: 1
});

type Prepare = typeof sqlite.prepare;
const prepare = sqlite.prepare.bind(sqlite);
let statements: string[] = [];
sqlite.prepare = ((source: string) => {
	statements.push(source);
	return prepare(source);
}) as Prepare;

function readsOf(table: string): number {
	const pattern = new RegExp(`from\\s+"?${table}"?\\b`, 'i');
	return statements.filter((source) => pattern.test(source)).length;
}

function seedGame(id: string, gameDate: string): void {
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status,
			  roster_template_json, generated_at, generation_json, created_at, updated_at)
			 values (?, ?, '09:00', 'arena', 'Aréna', 'scheduled', ?, 1, ?, 0, 0)`
		)
		.run(id, gameDate, TEMPLATE, SNAPSHOT);
	sqlite
		.prepare(
			`insert into game_slots
			 (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values (?, ?, 'white', 'forward', 0, 'manager', 'regular', 0, 0)`
		)
		.run(`${id}-slot`, id);
	sqlite
		.prepare(
			`insert into game_availability (game_id, player_id, status, updated_at)
			 values (?, 'manager', 'present', 0)`
		)
		.run(id);
}

beforeEach(() => {
	for (const table of [
		'game_player_ratings',
		'player_ratings',
		'game_goals',
		'game_penalties',
		'game_slots',
		'game_availability',
		'games',
		'locations',
		'pair_rules',
		'sub_requests',
		'sub_profiles',
		'audit_log',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('manager', 'Gérant', 'manager@example.test', 1, 0, 0, 'manager')`
		)
		.run();
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, jersey_number, is_substitute, active, created_at, updated_at)
			 values ('manager', 'Gérant', 'Test', 'forward', 30, 9, 0, 1, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into player_ratings (player_id, attribute, value, updated_at)
			 values ('manager', 'passing', 4, 0)`
		)
		.run();
	statements = [];
});

function loadMatchPage(id: string) {
	return loadMatch({
		locals: { actor: manager },
		params: { id },
		parent: async () => ({ isSubstitute: false })
	} as never);
}

describe('lectures de la fiche de match', () => {
	it('lit un match commencé une seule fois pour la feuille et la présence', async () => {
		seedGame('started', '2020-01-05');
		const data = (await loadMatchPage('started')) as {
			game: { id: string };
			sheet: { gameId: string } | null;
		};

		expect(data.game.id).toBe('started');
		expect(data.sheet?.gameId).toBe('started');
		expect(readsOf('games')).toBe(1);
	});

	it('lit les notes du bassin vivant une seule fois pour un match à venir', async () => {
		seedGame('future', '2099-01-04');
		const data = (await loadMatchPage('future')) as {
			game: { id: string };
			sheet: { gameId: string } | null;
			availability: { present: number };
		};

		expect(data.game.id).toBe('future');
		expect(data.sheet).toBeNull();
		expect(data.availability.present).toBe(1);
		expect(readsOf('games')).toBe(1);
		expect(readsOf('player_ratings')).toBe(1);
	});

	it('lit le prochain match du tableau de bord une seule fois', async () => {
		seedGame('next', '2099-01-04');
		const admin: Actor = {
			kind: 'user',
			active: true,
			userId: 'manager',
			name: 'Gérant',
			role: 'admin'
		};

		statements = [];
		const data = (await loadAdmin({ locals: { actor: admin } } as never)) as {
			nextGame: { id: string } | null;
			nextAvailability: { present: number } | null;
		};

		expect(data.nextGame?.id).toBe('next');
		expect(data.nextAvailability?.present).toBe(1);
		// La liste des matchs et la fiche du prochain match, rien de plus.
		expect(readsOf('games')).toBe(2);
		expect(readsOf('player_ratings')).toBe(1);
	});
});
