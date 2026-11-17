import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

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
const { load } = await import('./+page.server.ts');

const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'player',
	name: 'Joueur',
	role: 'player'
};

beforeEach(() => {
	for (const table of [
		'game_penalties',
		'game_goals',
		'game_slots',
		'games',
		'locations',
		'payments',
		'payment_plans',
		'session',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('player', 'Joueur', 'player@example.test', 1, 0, 0, 'player')`
		)
		.run();
	sqlite
		.prepare(
			`insert into players (user_id, first_name, last_name, position, age, jersey_number, is_substitute, active, created_at, updated_at)
			 values ('player', 'Jean', 'Bouchard', 'forward', 30, 9, 0, 1, 0, 0)`
		)
		.run();
});

type StatsData = {
	stats: {
		games: number;
		goals: number;
		assists: number;
		penalties: number;
		points: number;
		pointsPerGame: number;
	} | null;
};

async function loadFor(actor: Actor = player): Promise<StatsData> {
	return (await load({
		locals: { actor, sessionId: null },
		parent: async () => ({ isSubstitute: false })
	} as never)) as unknown as StatsData;
}

function addCompletedGame(): void {
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, completed_at,
			  roster_template_json, created_at, updated_at)
			 values ('game', '2026-11-01', '19:00', 'arena', 'Aréna', 'completed', 1,
			  '{}', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into game_slots
			 (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values ('slot', 'game', 'white', 'forward', 0, 'player', 'regular', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into game_goals
			 (id, game_id, team, period, clock, kind, scorer_player_id, scorer_name, scorer_number,
			  assist1_player_id, assist1_name, assist1_number, created_at, updated_at)
			 values ('goal-1', 'game', 'white', 1, '10:00', 'even', 'player', 'Jean Bouchard', 9,
			  null, null, null, 0, 0),
			        ('goal-2', 'game', 'white', 2, '12:00', 'power_play', 'player', 'Jean Bouchard', 9,
			  'player', 'Jean Bouchard', 9, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into game_penalties
			 (id, game_id, team, period, clock, infraction, minutes, player_id, player_name, player_number, created_at, updated_at)
			 values ('penalty-1', 'game', 'white', 1, '05:00', 'trebucher', 2, 'player', 'Jean Bouchard', 9, 0, 0)`
		)
		.run();
}

describe('données de stats du profil', () => {
	it('remonte les totaux personnels calculés sur les matchs terminés', async () => {
		addCompletedGame();

		const data = await loadFor();

		expect(data.stats).toEqual({
			games: 1,
			goals: 2,
			assists: 1,
			penaltyMinutes: 2,
			points: 3,
			pointsPerGame: 3
		});
	});

	it('renvoie des zéros bruts quand aucun match n’est terminé', async () => {
		const data = await loadFor();

		expect(data.stats).toEqual({
			games: 0,
			goals: 0,
			assists: 0,
			penaltyMinutes: 0,
			points: 0,
			pointsPerGame: 0
		});
	});

	it('ne transporte aucun champ de note ou d’habileté vers la carte', async () => {
		addCompletedGame();

		const stats = (await loadFor()).stats;

		expect(stats).not.toBeNull();
		expect(Object.keys(stats!).sort()).toEqual([
			'assists',
			'games',
			'goals',
			'penaltyMinutes',
			'points',
			'pointsPerGame'
		]);
		for (const forbidden of ['overall', 'ratings', 'skills', 'positionOverall']) {
			expect(stats).not.toHaveProperty(forbidden);
		}
	});

	it('ne fournit pas de stats à un compte sans fiche de joueur', async () => {
		sqlite.prepare(`delete from players`).run();
		expect((await loadFor()).stats).toBeNull();
	});

	it('lit la présence remplaçant résolue par le layout', async () => {
		const data = (await load({
			locals: { actor: player, sessionId: null },
			parent: async () => ({ isSubstitute: true })
		} as never)) as unknown as { isSubstitute: boolean };

		expect(data.isSubstitute).toBe(true);
	});
});
