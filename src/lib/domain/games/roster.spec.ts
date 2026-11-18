import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Position } from '#config/positions.ts';
import { RATING_ATTRIBUTE_KEYS } from '#config/rating-attributes.ts';
import { buildSlotDefinitions } from '#config/roster.ts';
import type { Actor } from '#lib/domain/auth/types.ts';

const h = vi.hoisted(() => ({
	now: Date.UTC(2026, 10, 16, 18, 0),
	settings: {
		'roster.goaliesPerTeam': 0,
		'roster.forwardsPerTeam': 2,
		'roster.defensePerTeam': 0,
		'roster.playersPerTeam': 4,
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
const { saveManualLineup } = await import('./lineup.ts');
const { getGame, regenerateAsAdmin } = await import('./service.ts');
const { lineupIntelligence } = await import('./alignment.ts');

const manager: Actor = {
	kind: 'user', active: true,
	userId: 'manager', name: 'Gérant', role: 'manager'
};

// Deux attaquant par équipe sur la glace, effectif de quatre : deux au banc.
const TEMPLATE = JSON.stringify({
	goaliesPerTeam: 0,
	forwardsPerTeam: 2,
	defensePerTeam: 0,
	playersPerTeam: 4
});

const LEGACY_TEMPLATE = JSON.stringify({
	goaliesPerTeam: 0,
	forwardsPerTeam: 2,
	defensePerTeam: 0
});

const EMPTY_SNAPSHOT = {
	skillDiff: 0, ageDiff: 0, sizeDiff: 0,
	warnings: [] as string[], ruleViolations: [] as unknown[],
	bench: [] as unknown[], candidateKey: '', generatedAt: 1
};

function captureError(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	throw new Error('expected an error');
}

function addPlayer(id: string, position: Position = 'forward', rating = 3): void {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values (?, ?, ?, 1, 0, 0, 'player')`
		)
		.run(id, id, `${id}@example.test`);
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, jersey_number, is_substitute, active, created_at, updated_at)
			 values (?, ?, 'Test', ?, 30, null, 0, 1, 0, 0)`
		)
		.run(id, id, position);
	const statement = sqlite.prepare(
		`insert into player_ratings (player_id, attribute, value, updated_at) values (?, ?, ?, 0)`
	);
	for (const attribute of RATING_ATTRIBUTE_KEYS) statement.run(id, attribute, rating);
}

function addGame(template = TEMPLATE): void {
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, roster_template_json,
			  generated_at, generation_json, created_at, updated_at)
			 values ('game', '2026-11-20', '09:00', 'arena', 'Aréna', 'scheduled', ?, 1, ?, 0, 0)`
		)
		.run(template, JSON.stringify(EMPTY_SNAPSHOT));
	for (const slot of buildSlotDefinitions(JSON.parse(template))) {
		sqlite
			.prepare(
				`insert into game_slots (id, game_id, team, position, slot_index, created_at, updated_at)
				 values (?, 'game', ?, ?, ?, 0, 0)`
			)
			.run(`game:${slot.team}:${slot.position}:${slot.index}`, slot.team, slot.position, slot.index);
	}
}

function setPresent(playerId: string): void {
	sqlite
		.prepare(
			`insert into game_availability (game_id, player_id, status, updated_at)
			 values ('game', ?, 'present', 0)`
		)
		.run(playerId);
}

function seedPlayers(count: number): string[] {
	const ids = Array.from({ length: count }, (_, index) => `p${index}`);
	for (const id of ids) {
		addPlayer(id);
		setPresent(id);
	}
	return ids;
}

function benchOf(gameId: string) {
	return getGame(manager, gameId).generation?.bench ?? [];
}

function gameRatings(playerId: string): number {
	return (
		sqlite
			.prepare(
				`select count(*) as count from game_player_ratings where game_id = 'game' and player_id = ?`
			)
			.get(playerId) as { count: number }
	).count;
}

function addGameRating(playerId: string): void {
	sqlite
		.prepare(
			`insert into game_player_ratings (game_id, player_id, attribute, value, updated_at)
			 values ('game', ?, 'impact', 4, 0)`
		)
		.run(playerId);
}

beforeEach(() => {
	for (const table of [
		'game_player_ratings', 'game_slots', 'games', 'locations', 'players',
		'audit_log', 'user', 'game_availability', 'player_ratings'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`)
		.run();
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('manager', 'Gérant', 'manager@example.test', 1, 0, 0, 'manager')`
		)
		.run();
});

describe('effectif habillé par équipe', () => {
	it('la génération habille un banc par équipe jusqu’à l’effectif configuré', () => {
		addGame();
		seedPlayers(8);

		regenerateAsAdmin(manager, 'game');

		const bench = benchOf('game');
		expect(bench).toHaveLength(4);
		expect(bench.filter((entry) => entry.team === 'white')).toHaveLength(2);
		expect(bench.filter((entry) => entry.team === 'black')).toHaveLength(2);
		expect(bench.every((entry) => entry.team !== null)).toBe(true);

		const intelligence = lineupIntelligence(manager, getGame(manager, 'game'));
		expect(intelligence.sizes).toEqual({ white: 4, black: 4 });
	});

	it('verse le surplus hors effectif quand les bancs sont pleins', () => {
		addGame();
		seedPlayers(10);

		regenerateAsAdmin(manager, 'game');

		const bench = benchOf('game');
		expect(bench.filter((entry) => entry.team === 'white')).toHaveLength(2);
		expect(bench.filter((entry) => entry.team === 'black')).toHaveLength(2);
		expect(bench.filter((entry) => entry.team === null)).toHaveLength(2);
	});

	it('un ancien instantané sans effectif ne drafte aucun banc habillé', () => {
		addGame(LEGACY_TEMPLATE);
		seedPlayers(8);

		regenerateAsAdmin(manager, 'game');

		const bench = benchOf('game');
		expect(bench).toHaveLength(4);
		expect(bench.every((entry) => entry.team === null)).toBe(true);
	});

	it('l’enregistrement manuel persiste le banc par équipe et refuse un effectif plein', () => {
		addGame();
		const ids = seedPlayers(8);
		regenerateAsAdmin(manager, 'game');

		const view = getGame(manager, 'game');
		const ice = view.slots.filter((slot) => slot.player);
		const assignments = view.slots.map((slot) => ({
			team: slot.team,
			position: slot.position,
			slotIndex: slot.slotIndex,
			playerId: slot.player?.playerId ?? null
		}));
		// Deux joueurs par équipe sur la glace, deux autres habillent le banc white.
		const benchIds = ids.filter(
			(id) => !ice.some((slot) => slot.player?.playerId === id)
		);
		const saved = saveManualLineup(manager, 'game', {
			expectedGeneratedAt: h.now,
			assignments,
			bench: [
				{ playerId: benchIds[0], team: 'white' },
				{ playerId: benchIds[1], team: 'white' }
			]
		});

		const bench = saved.generation?.bench ?? [];
		expect(bench.filter((entry) => entry.team === 'white')).toHaveLength(2);
		expect(bench.filter((entry) => entry.team === 'black')).toHaveLength(0);

		// Un troisième joueur white dépasse l'effectif de quatre.
		const error = captureError(() =>
			saveManualLineup(manager, 'game', {
				expectedGeneratedAt: h.now,
				assignments,
				bench: [
					{ playerId: benchIds[0], team: 'white' },
					{ playerId: benchIds[1], team: 'white' },
					{ playerId: benchIds[2], team: 'white' }
				]
			})
		);
		expect(error).toMatchObject({ code: 'VALIDATION', key: 'games.lineupRosterFull' });
	});

	it('un joueur sorti de la glace vers son banc garde ses notes, pas vers le hors effectif', () => {
		addGame();
		const ids = seedPlayers(8);
		regenerateAsAdmin(manager, 'game');

		const view = getGame(manager, 'game');
		const starter = view.slots.find((slot) => slot.player)?.player?.playerId;
		expect(starter).toBeDefined();
		addGameRating(starter!);
		expect(gameRatings(starter!)).toBe(1);

		const assignments = view.slots.map((slot) => ({
			team: slot.team,
			position: slot.position,
			slotIndex: slot.slotIndex,
			playerId: slot.player?.playerId === starter ? null : (slot.player?.playerId ?? null)
		}));
		const benchIds = ids.filter(
			(id) => id !== starter && !view.slots.some((slot) => slot.player?.playerId === id)
		);

		// Le starter rejoint le banc de son équipe : il garde ses notes.
		const starterTeam = view.slots.find((slot) => slot.player?.playerId === starter)!.team;
		saveManualLineup(manager, 'game', {
			expectedGeneratedAt: h.now,
			assignments,
			bench: [{ playerId: starter!, team: starterTeam }]
		});
		expect(gameRatings(starter!)).toBe(1);

		// Le même joueur quitte l'effectif (hors effectif) : ses notes partent.
		const after = getGame(manager, 'game');
		const nextAssignments = after.slots.map((slot) => ({
			team: slot.team,
			position: slot.position,
			slotIndex: slot.slotIndex,
			playerId: slot.player?.playerId ?? null
		}));
		saveManualLineup(manager, 'game', {
			expectedGeneratedAt: h.now,
			assignments: nextAssignments,
			bench: []
		});
		expect(gameRatings(starter!)).toBe(0);
		expect(benchIds.length).toBeGreaterThan(0);
	});
});
