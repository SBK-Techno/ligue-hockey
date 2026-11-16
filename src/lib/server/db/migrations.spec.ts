import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import { NOTIFICATION_CHANNEL_KEYS } from '#config/notification-channels.ts';
import { NOTIFICATION_EVENT_KEYS } from '#config/notification-events.ts';
import { PAYMENT_METHOD_KEYS } from '#config/payment-methods.ts';
import { POSITION_KEYS } from '#config/positions.ts';
import { INFRACTION_KEYS, PENALTY_MINUTES } from '#config/infractions.ts';
import { PERIOD_NUMBERS } from '#config/periods.ts';
import { GOAL_KIND_KEYS } from '#lib/domain/gamesheet/schema.ts';
import {
	RATING_ATTRIBUTE_KEYS,
	POSITION_RATING_KEYS,
	GAME_RATING_KEYS
} from '#config/rating-attributes.ts';
import { SETTINGS_KEYS, SETTINGS } from '#config/settings-registry.ts';
import { TEAM_KEYS } from '#config/teams.ts';

/**
 * Le schéma SQL est généré à partir des registres de code, mais rien ne
 * garantissait qu'une migration commitée suive : une clé ajoutée au registre
 * sans migration faisait échouer chaque sauvegarde en production.
 *
 * Ce test part des migrations réelles, pas du schéma Drizzle, puis compare
 * chaque contrainte CHECK à son registre. Toute valeur acceptée par le code
 * mais refusée par la base fait échouer la porte.
 */

const MIGRATIONS = 'drizzle';
const NOW = 1_700_000_000_000;
const SETTING_KEYS: readonly string[] = SETTINGS_KEYS;

type Coverage = {
	label: string;
	table: string;
	constraint: string;
	values: readonly string[];
	/** La contrainte compare des entiers nus, sans apostrophes. */
	numeric?: boolean;
};

const COVERAGE: readonly Coverage[] = [
	{
		label: 'league_settings.key',
		table: 'league_settings',
		constraint: 'league_settings_key_check',
		values: SETTINGS_KEYS
	},
	{
		label: 'players.position',
		table: 'players',
		constraint: 'players_position_check',
		values: POSITION_KEYS
	},
	{
		label: 'game_slots.team',
		table: 'game_slots',
		constraint: 'game_slots_team_check',
		values: TEAM_KEYS
	},
	{
		label: 'game_slots.position',
		table: 'game_slots',
		constraint: 'game_slots_position_check',
		values: POSITION_KEYS
	},
	{
		label: 'sub_requests.position',
		table: 'sub_requests',
		constraint: 'sub_requests_position_check',
		values: POSITION_KEYS
	},
	{
		label: 'player_ratings.attribute',
		table: 'player_ratings',
		constraint: 'player_ratings_attribute_check',
		values: [...RATING_ATTRIBUTE_KEYS, ...POSITION_RATING_KEYS]
	},
	{
		label: 'game_player_ratings.attribute',
		table: 'game_player_ratings',
		constraint: 'game_player_ratings_attribute_check',
		values: GAME_RATING_KEYS
	},
	{
		label: 'payments.method',
		table: 'payments',
		constraint: 'payments_method_check',
		values: PAYMENT_METHOD_KEYS
	},
	{
		label: 'notification_jobs.channel',
		table: 'notification_jobs',
		constraint: 'notification_jobs_channel_check',
		values: NOTIFICATION_CHANNEL_KEYS
	},
	{
		label: 'notification_jobs.event_key',
		table: 'notification_jobs',
		constraint: 'notification_jobs_event_check',
		values: NOTIFICATION_EVENT_KEYS
	},
	{
		label: 'game_goals.team',
		table: 'game_goals',
		constraint: 'game_goals_team_check',
		values: TEAM_KEYS
	},
	{
		label: 'game_goals.period',
		table: 'game_goals',
		constraint: 'game_goals_period_check',
		values: PERIOD_NUMBERS.map(String),
		numeric: true
	},
	{
		label: 'game_goals.kind',
		table: 'game_goals',
		constraint: 'game_goals_kind_check',
		values: GOAL_KIND_KEYS
	},
	{
		label: 'game_penalties.team',
		table: 'game_penalties',
		constraint: 'game_penalties_team_check',
		values: TEAM_KEYS
	},
	{
		label: 'game_penalties.period',
		table: 'game_penalties',
		constraint: 'game_penalties_period_check',
		values: PERIOD_NUMBERS.map(String),
		numeric: true
	},
	{
		label: 'game_penalties.infraction',
		table: 'game_penalties',
		constraint: 'game_penalties_infraction_check',
		values: INFRACTION_KEYS
	},
	{
		label: 'game_penalties.minutes',
		table: 'game_penalties',
		constraint: 'game_penalties_minutes_check',
		values: PENALTY_MINUTES.map(String),
		numeric: true
	}
];

function migrateInMemory(): Database.Database {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS });
	return sqlite;
}

function tableSql(sqlite: Database.Database, table: string): string {
	const row = sqlite
		.prepare("select sql from sqlite_master where type = 'table' and name = ?")
		.get(table) as { sql: string } | undefined;
	if (!row) throw new Error(`missing table: ${table}`);
	return row.sql;
}

/**
 * Lit les valeurs entre apostrophes d'une contrainte nommée. Les contraintes
 * de registre ne contiennent que ces littéraux, donc la comparaison ensembliste
 * détecte à la fois une valeur manquante et une valeur morte.
 */
function constraintLiterals(ddl: string, constraint: string): string[] {
	const marker = `CONSTRAINT "${constraint}"`;
	const start = ddl.indexOf(marker);
	if (start === -1) return [];
	const next = ddl.indexOf('CONSTRAINT "', start + marker.length);
	const body = ddl.slice(start, next === -1 ? undefined : next);
	return [...body.matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

/** Les contraintes numériques comparent des entiers nus, sans apostrophes. */
function constraintNumbers(ddl: string, constraint: string): string[] {
	const marker = `CONSTRAINT "${constraint}"`;
	const start = ddl.indexOf(marker);
	if (start === -1) return [];
	const next = ddl.indexOf('CONSTRAINT "', start + marker.length);
	const body = ddl.slice(start, next === -1 ? undefined : next);
	return [...body.matchAll(/\b(\d+)\b/g)].map((match) => match[1]);
}

function migrationTags(): string[] {
	return readdirSync(MIGRATIONS)
		.filter((file) => file.endsWith('.sql'))
		.map((file) => file.slice(0, -'.sql'.length))
		.sort();
}

function journalTags(): string[] {
	const journal = JSON.parse(
		readFileSync(`${MIGRATIONS}/meta/_journal.json`, 'utf8')
	) as { entries: { tag: string }[] };
	return journal.entries.map((entry) => entry.tag).sort();
}

describe('migrations vs registres', () => {
	const sqlite = migrateInMemory();
	const ddl = new Map(
		[...new Set(COVERAGE.map((probe) => probe.table))].map((table) => [
			table,
			tableSql(sqlite, table)
		])
	);

	it('applique chaque migration du journal', () => {
		expect(journalTags()).toEqual(migrationTags());
		const applied = sqlite
			.prepare('select count(*) as count from __drizzle_migrations')
			.get() as { count: number };
		expect(applied.count).toBe(journalTags().length);
	});

	for (const probe of COVERAGE) {
		it(`${probe.label} accepte exactement les valeurs du registre`, () => {
			const literals = probe.numeric
				? constraintNumbers(ddl.get(probe.table) ?? '', probe.constraint)
				: constraintLiterals(ddl.get(probe.table) ?? '', probe.constraint);

			expect(
				literals.length,
				`contrainte ${probe.constraint} absente de ${probe.table}: lance npm run db:generate`
			).toBeGreaterThan(0);
			expect([...new Set(literals)].sort()).toEqual([...probe.values].sort());
		});
	}

	it('crée l’inventaire complet des tables', () => {
		const tables = (
			sqlite
				.prepare(
					"select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name"
				)
				.all() as { name: string }[]
		).map((row) => row.name);

		expect(tables).toEqual([
			'__drizzle_migrations',
			'account',
			'audit_log',
			'chat_messages',
			'game_availability',
			'game_goals',
			'game_penalties',
			'game_player_ratings',
			'game_slots',
			'games',
			'league_settings',
			'locations',
			'notification_jobs',
			'notification_preferences',
			'pair_rules',
			'payment_plans',
			'payments',
			'player_ratings',
			'players',
			'poll_options',
			'poll_votes',
			'polls',
			'push_subscriptions',
			'session',
			'sub_profiles',
			'sub_requests',
			'user',
			'verification'
		]);
	});

	it('la dernière migration accepte les données écrites par la précédente', () => {
		const folder = mkdtempSync(join(tmpdir(), 'lhdm-migrations-'));
		try {
			cpSync(MIGRATIONS, folder, { recursive: true });
			const journalPath = join(folder, 'meta/_journal.json');
			const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
				entries: { tag: string }[];
			};
			if (journal.entries.length === 0) throw new Error('aucune migration');

			writeFileSync(
				journalPath,
				JSON.stringify({ ...journal, entries: journal.entries.slice(0, -1) })
			);

			const previous = new Database(':memory:');
			previous.pragma('foreign_keys = ON');
			migrate(drizzle(previous), { migrationsFolder: folder });

			const previousKeys = constraintLiterals(
				tableSql(previous, 'league_settings'),
				'league_settings_key_check'
			);
			expect(previousKeys.length).toBeGreaterThan(0);
			const insert = previous.prepare(
				'insert into league_settings (key, value_json, updated_at) values (?, ?, ?)'
			);
			for (const key of previousKeys) insert.run(key, 'null', NOW);

			cpSync(MIGRATIONS, folder, { recursive: true });
			migrate(drizzle(previous), { migrationsFolder: folder });

			const remaining = previous
				.prepare('select key from league_settings order by key')
				.all() as { key: string }[];
			const kept = previousKeys.filter((key) => SETTING_KEYS.includes(key));
			expect(remaining.map((row) => row.key)).toEqual([...kept].sort());
			previous.close();
		} finally {
			rmSync(folder, { recursive: true, force: true });
		}
	});

	it('convertit les libellés de matchs en lieux sans perdre les tables enfants', () => {
		const folder = mkdtempSync(join(tmpdir(), 'lhdm-locations-'));
		try {
			cpSync(MIGRATIONS, folder, { recursive: true });
			const journalPath = join(folder, 'meta/_journal.json');
			const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
				entries: { tag: string }[];
			};
			const locationsIndex = journal.entries.findIndex(
				(entry) => entry.tag === '0006_known_beast'
			);
			if (locationsIndex <= 0) throw new Error('migration locations absente');
			writeFileSync(
				journalPath,
				JSON.stringify({
					...journal,
					entries: journal.entries.slice(0, locationsIndex)
				})
			);

			const previous = new Database(':memory:');
			previous.pragma('foreign_keys = ON');
			migrate(drizzle(previous), { migrationsFolder: folder });

			previous
				.prepare(
					`insert into user (id, name, email, email_verified, created_at, updated_at)
					 values ('u1', 'Joueur', 'joueur@example.test', 1, ?, ?)`
				)
				.run(NOW, NOW);
			previous
				.prepare(
					`insert into players (user_id, first_name, last_name, position, age, created_at, updated_at)
					 values ('u1', 'Joueur', 'Test', 'forward', 30, ?, ?)`
				)
				.run(NOW, NOW);

			const insertGame = previous.prepare(
				`insert into games (id, game_date, start_time, location, roster_template_json, created_at, updated_at)
				 values (?, ?, ?, ?, ?, ?, ?)`
			);
			insertGame.run('g1', '2026-01-04', '09:00', 'Aréna A', '{}', NOW, NOW);
			insertGame.run('g2', '2026-01-11', '09:00', 'Aréna B', '{}', NOW, NOW);
			insertGame.run('g3', '2026-01-18', '09:00', 'Aréna A', '{}', NOW, NOW);

			previous
				.prepare(
					`insert into game_slots (id, game_id, team, position, slot_index, created_at, updated_at)
					 values ('s1', 'g1', 'white', 'forward', 0, ?, ?)`
				)
				.run(NOW, NOW);
			previous
				.prepare(
					`insert into game_availability (game_id, player_id, status, updated_at)
					 values ('g1', 'u1', 'present', ?)`
				)
				.run(NOW);
			previous
				.prepare(
					`insert into sub_requests (id, game_id, position, reason, status, created_at)
					 values ('r1', 'g1', 'forward', 'manual', 'open', ?)`
				)
				.run(NOW);
			previous
				.prepare(
					`insert into game_player_ratings (game_id, player_id, attribute, value, updated_at)
					 values ('g1', 'u1', 'impact', 3, ?)`
				)
				.run(NOW);

			cpSync(MIGRATIONS, folder, { recursive: true });
			migrate(drizzle(previous), { migrationsFolder: folder });

			const locations = previous
				.prepare('select id, name from locations order by id')
				.all() as { id: string; name: string }[];
			expect(locations).toEqual([
				{ id: 'loc_1', name: 'Aréna A' },
				{ id: 'loc_2', name: 'Aréna B' }
			]);

			const games = previous
				.prepare(
					`select games.id, games.location, games.location_id, locations.name
					 from games
					 inner join locations on locations.id = games.location_id
					 order by games.id`
				)
				.all() as {
				id: string;
				location: string;
				location_id: string;
				name: string;
			}[];
			expect(games).toEqual([
				{ id: 'g1', location: 'Aréna A', location_id: 'loc_1', name: 'Aréna A' },
				{ id: 'g2', location: 'Aréna B', location_id: 'loc_2', name: 'Aréna B' },
				{ id: 'g3', location: 'Aréna A', location_id: 'loc_1', name: 'Aréna A' }
			]);
			expect(locations).toHaveLength(2);

			const missing = previous
				.prepare('select count(*) as count from games where location_id is null')
				.get() as { count: number };
			expect(missing.count).toBe(0);

			for (const table of [
				'game_slots',
				'game_availability',
				'sub_requests',
				'game_player_ratings'
			]) {
				const row = previous
					.prepare(`select count(*) as count from ${table}`)
					.get() as { count: number };
				expect(row.count, table).toBe(1);
			}
			expect(previous.prepare('pragma foreign_key_check').all()).toEqual([]);

			const indexes = previous
				.prepare(
					"select name, sql from sqlite_master where type = 'index' and tbl_name = 'games'"
				)
				.all() as { name: string; sql: string | null }[];
			const indexNames = indexes.map((index) => index.name);
			expect(indexNames).toContain('games_schedule_unique');
			expect(indexNames).toContain('games_location_idx');
			const scheduleIndex = indexes.find(
				(index) => index.name === 'games_schedule_unique'
			);
			expect(scheduleIndex?.sql).toContain('WHERE "status" <> \'cancelled\'');

			previous.close();
		} finally {
			rmSync(folder, { recursive: true, force: true });
		}
	});

	it('accepte chaque clé de réglage avec sa valeur par défaut', () => {
		const insert = sqlite.prepare(
			'insert into league_settings (key, value_json, updated_at) values (?, ?, ?)'
		);
		for (const key of SETTINGS_KEYS) {
			const value =
				JSON.stringify(SETTINGS[key].defaultValue as unknown) ?? 'null';
			expect(
				() => insert.run(key, value, NOW),
				`la base refuse la clé ${key}: migration manquante`
			).not.toThrow();
		}
		sqlite.prepare('delete from league_settings').run();
	});

	it('détecte une clé du registre absente de la migration', () => {
		const stale = `CREATE TABLE "league_settings" (
			CONSTRAINT "league_settings_key_check" CHECK("key" in ('league.seasonLabel'))
		)`;

		const literals = constraintLiterals(stale, 'league_settings_key_check');
		const missing = SETTINGS_KEYS.filter((key) => !literals.includes(key));

		expect(literals).toEqual(['league.seasonLabel']);
		expect(missing).toContain('teams.maxAgeSpread');
		expect(missing.length).toBe(SETTINGS_KEYS.length - 1);
	});

	it('borne les notes de saison et de match entre 1 et 5', () => {
		const db = migrateInMemory();
		db.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at)
			 values ('rating-user', 'Joueur', 'rating@example.test', 1, ?, ?)`
		).run(NOW, NOW);
		db.prepare(
			`insert into players (user_id, first_name, last_name, position, age, created_at, updated_at)
			 values ('rating-user', 'Joueur', 'Test', 'forward', 30, ?, ?)`
		).run(NOW, NOW);
		db.prepare(
			`insert into locations (id, name, created_at, updated_at)
			 values ('rating-location', 'Aréna test', ?, ?)`
		).run(NOW, NOW);
		db.prepare(
			`insert into games (id, game_date, start_time, location_id, location, roster_template_json, created_at, updated_at)
			 values ('rating-game', '2026-11-16', '09:00', 'rating-location', 'Aréna test', '{}', ?, ?)`
		).run(NOW, NOW);

		const season = db.prepare(
			`insert into player_ratings (player_id, attribute, value, updated_at)
			 values ('rating-user', 'passing', ?, ?)`
		);
		const game = db.prepare(
			`insert into game_player_ratings (game_id, player_id, attribute, value, updated_at)
			 values ('rating-game', 'rating-user', 'impact', ?, ?)`
		);

		for (const value of [0, 6]) {
			expect(() => season.run(value, NOW), `saison ${value}`).toThrow(
				/CHECK constraint failed/i
			);
			expect(() => game.run(value, NOW), `match ${value}`).toThrow(
				/CHECK constraint failed/i
			);
		}
		for (const value of [1, 5]) {
			expect(() => season.run(value, NOW)).not.toThrow();
			db.prepare("delete from player_ratings where player_id = 'rating-user'").run();
			expect(() => game.run(value, NOW)).not.toThrow();
			db.prepare("delete from game_player_ratings where game_id = 'rating-game'").run();
		}
		db.close();
	});

	it('refuse une clé de réglage inconnue', () => {
		expect(() =>
			sqlite
				.prepare(
					'insert into league_settings (key, value_json, updated_at) values (?, ?, ?)'
				)
				.run('league.unknown', 'null', NOW)
		).toThrow(/CHECK constraint failed/i);
	});
});
