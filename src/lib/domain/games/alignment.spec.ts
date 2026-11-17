import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Position } from '#config/positions.ts';
import {
	RATING_ATTRIBUTE_KEYS,
	gameRatingAttributes
} from '#config/rating-attributes.ts';
import { buildSlotDefinitions, type RosterTemplate } from '#config/roster.ts';
import type { Actor } from '#lib/domain/auth/types.ts';

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
		clock: { nowMs: () => h.now },
		todayInZone: () => '2026-11-16'
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
const { saveGameAssessment } = await import('#lib/domain/ratings/service.ts');
const { findGame } = await import('./queries.ts');
const { getGame, regenerateAsAdmin } = await import('./service.ts');
const { markAvailability } = await import('#lib/domain/availability/service.ts');
const { applyBestSwap, fillOpenSlots, lineupIntelligence, validateAssignments } = await import(
	'./alignment.ts'
);

const admin: Actor = {
	kind: 'user', active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

const manager: Actor = {
	kind: 'user', active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'manager'
};

const playerActor: Actor = {
	kind: 'user', active: true,
	userId: 'member',
	name: 'Member',
	role: 'player'
};

const defaultTemplate: RosterTemplate = {
	forwardsPerTeam: 2,
	defensePerTeam: 0,
	goaliesPerTeam: 0
};

const forwardsOnly: RosterTemplate = defaultTemplate;

let gameSequence = 0;

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
	options: {
		position?: Position;
		age?: number;
		overall?: number;
		substitute?: boolean;
		active?: boolean;
		complete?: boolean;
	} = {}
): void {
	const position = options.position ?? 'forward';
	addUser(id, 'player');
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, jersey_number, is_substitute, active, created_at, updated_at)
			 values (?, ?, 'Test', ?, ?, ?, ?, ?, 0, 0)`
		)
		.run(
			id,
			id,
			position,
			options.age ?? 30,
			null,
			options.substitute ? 1 : 0,
			options.active === false ? 0 : 1
		);
	const overall = options.overall ?? 3;
	const attributes = options.complete === false ? RATING_ATTRIBUTE_KEYS.slice(0, 2) : RATING_ATTRIBUTE_KEYS;
	const statement = sqlite.prepare(
		`insert into player_ratings (player_id, attribute, value, updated_at, updated_by)
		 values (?, ?, ?, 0, null)`
	);
	for (const attribute of attributes) {
		statement.run(id, attribute, overall);
	}
}

function addLocation(id = 'arena'): string {
	sqlite
		.prepare(
			`insert into locations (id, name, address, map_url, notes, created_at, updated_at)
			 values (?, ?, null, null, null, 0, 0)`
		)
		.run(id, `Aréna ${id}`);
	return id;
}

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

type Assignment = { playerId: string; kind?: 'regular' | 'sub' };

function addGame(options: {
	roster?: RosterTemplate;
	status?: 'scheduled' | 'cancelled' | 'completed';
	gameDate?: string;
	generated?: boolean;
	templateJson?: string;
	assignments?: Record<string, Assignment>;
} = {}): string {
	gameSequence += 1;
	const id = `game-${gameSequence}`;
	const roster = options.roster ?? defaultTemplate;
	const date = options.gameDate ?? `2026-12-${String(gameSequence).padStart(2, '0')}`;
	const generated = options.generated ?? true;
	const location = addLocationIfMissing();
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, notes, status,
			  completed_at, roster_template_json, generated_at, generation_json, created_by, created_at, updated_at)
			 values (?, ?, '09:00', ?, ?, null, ?, ?, ?, ?, ?, null, 0, 0)`
		)
		.run(
			id,
			date,
			location,
			'Aréna arena',
			options.status ?? 'scheduled',
			options.status === 'completed' ? 1 : null,
			options.templateJson ?? JSON.stringify(roster),
			generated ? 1 : null,
			generated ? JSON.stringify(EMPTY_SNAPSHOT) : null
		);

	const slotStatement = sqlite.prepare(
		`insert into game_slots
		 (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
		 values (?, ?, ?, ?, ?, ?, ?, 0, 0)`
	);
	for (const slot of buildSlotDefinitions(roster)) {
		const assignment = options.assignments?.[`${slot.team}:${slot.position}:${slot.index}`];
		slotStatement.run(
			`${id}:${slot.team}:${slot.position}:${slot.index}`,
			id,
			slot.team,
			slot.position,
			slot.index,
			assignment?.playerId ?? null,
			assignment ? (assignment.kind ?? 'regular') : null
		);
	}

	return id;
}

let locationCreated = false;
function addLocationIfMissing(): string {
	if (locationCreated) return 'arena';
	locationCreated = true;
	return addLocation();
}

function setPresent(gameId: string, playerId: string, status: 'present' | 'absent' = 'present'): void {
	sqlite
		.prepare(
			`insert into game_availability (game_id, player_id, status, updated_at)
			 values (?, ?, ?, 0)`
		)
		.run(gameId, playerId, status);
}

function addClaim(
	gameId: string,
	playerId: string,
	position: Position,
	filledAt = 100
): void {
	sqlite
		.prepare(
			`insert into sub_requests
			 (id, game_id, requested_by_player_id, created_by_user_id, position, reason,
			  status, created_at, filled_by_player_id, filled_at, cancelled_at)
			 values (?, ?, null, null, ?, 'manual', 'filled', 0, ?, ?, null)`
		)
		.run(`request-${gameId}-${playerId}`, gameId, position, playerId, filledAt);
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

function addGameRatings(
	gameId: string,
	playerId: string,
	position: Position,
	value = 4
): void {
	const statement = sqlite.prepare(
		`insert into game_player_ratings
		 (game_id, player_id, attribute, value, updated_at, updated_by)
		 values (?, ?, ?, ?, 0, null)`
	);
	for (const attribute of gameRatingAttributes(position)) {
		statement.run(gameId, playerId, attribute.key, value);
	}
}

function gameRatingRows(gameId: string, playerId: string) {
	return sqlite
		.prepare(
			`select attribute, value from game_player_ratings
			 where game_id = ? and player_id = ? order by attribute`
		)
		.all(gameId, playerId) as { attribute: string; value: number }[];
}

function snapshotOf(gameId: string) {
	const row = findGame(gameId);
	if (!row?.generationJson) throw new Error('missing snapshot');
	return JSON.parse(row.generationJson) as {
		skillDiff: number | null;
		ageDiff: number;
		sizeDiff: number;
		warnings: string[];
		bench: { playerId: string; position: Position; kind: string }[];
	};
}

beforeEach(() => {
	for (const table of [
		'audit_log',
		'game_player_ratings',
		'game_slots',
		'game_availability',
		'sub_requests',
		'pair_rules',
		'player_ratings',
		'games',
		'players',
		'user',
		'locations'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	addUser('admin', 'admin');
	addUser('member', 'player');
	gameSequence = 0;
	locationCreated = false;
	h.settings = {
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
	};
});

describe('presence recalibration', () => {
	it('removes an absent regular and rebuilds the two teams from the live pool', () => {
		for (const [id, overall, age] of [
			['a', 5, 20],
			['b', 4, 30],
			['c', 3, 40],
			['d', 2, 50]
		] as const) {
			addPlayer(id, { overall, age });
		}
		const gameId = addGame({ generated: false });
		for (const id of ['a', 'b', 'c', 'd']) setPresent(gameId, id);

		regenerateAsAdmin(admin, gameId);
		const before = getGame(admin, gameId);
		expect(before.slots.some((slot) => slot.player?.playerId === 'a')).toBe(true);
		expect(before.slots.filter((slot) => slot.player !== null)).toHaveLength(4);

		const actorA: Actor = { kind: 'user', active: true, userId: 'a', name: 'a', role: 'player' };
		const result = markAvailability(actorA, gameId, 'absent');

		expect(result.regenerated).toBe(true);
		const after = getGame(admin, gameId);
		expect(after.slots.some((slot) => slot.player?.playerId === 'a')).toBe(false);
		expect(after.slots.filter((slot) => slot.player !== null)).toHaveLength(3);
		expect(after.slots.filter((slot) => slot.player === null)).toHaveLength(1);
	});
});

describe('alignment permissions and playability', () => {
	it('forbids a non-manager from reading rating averages or changing the lineup', () => {
		addPlayer('a', { overall: 5 });
		const gameId = addGame({ assignments: { 'white:forward:0': { playerId: 'a' } } });
		const game = getGame(playerActor, gameId);

		expect(captureError(() => lineupIntelligence(playerActor, game))).toMatchObject({
			code: 'FORBIDDEN'
		});
		expect(captureError(() => applyBestSwap(playerActor, gameId))).toMatchObject({
			code: 'FORBIDDEN'
		});
		expect(captureError(() => fillOpenSlots(playerActor, gameId))).toMatchObject({
			code: 'FORBIDDEN'
		});
	});

	it.each([
		['completed', 'completed'],
		['cancelled', 'cancelled']
	] as const)('rejects a %s game', (_label, status) => {
		addPlayer('a', { overall: 5 });
		const gameId = addGame({
			status,
			assignments: { 'white:forward:0': { playerId: 'a' } }
		});

		expect(captureError(() => applyBestSwap(manager, gameId))).toMatchObject({
			code: 'CONFLICT',
			key: 'games.lineupLocked'
		});
		expect(captureError(() => fillOpenSlots(manager, gameId))).toMatchObject({
			code: 'CONFLICT',
			key: 'games.lineupLocked'
		});
	});

	it('rejects a scheduled game whose start time has passed', () => {
		addPlayer('a', { overall: 5 });
		const gameId = addGame({
			gameDate: '2026-11-10',
			assignments: { 'white:forward:0': { playerId: 'a' } }
		});

		expect(captureError(() => applyBestSwap(manager, gameId))).toMatchObject({
			code: 'CONFLICT',
			key: 'games.lineupLocked'
		});
	});

	it('reports an invalid roster template snapshot as an internal error', () => {
		addPlayer('a', { overall: 5 });
		const gameId = addGame({ templateJson: '{"forwardsPerTeam":-1}' });

		expect(captureError(() => regenerateAsAdmin(manager, gameId))).toMatchObject({
			code: 'INTERNAL'
		});
	});
});

describe('fillOpenSlots with the live pool', () => {
	it('fills from present players missing from the saved snapshot and reports the written count', () => {
		addPlayer('a', { overall: 5 });
		addPlayer('b', { overall: 5 });
		addPlayer('c', { overall: 1 });
		addPlayer('d', { overall: 3 });
		addPlayer('e', { overall: 3 });
		const gameId = addGame({
			assignments: {
				'white:forward:0': { playerId: 'a' },
				'black:forward:0': { playerId: 'b' },
				'black:forward:1': { playerId: 'c' }
			}
		});
		setPresent(gameId, 'd');
		setPresent(gameId, 'e');

		const before = lineupIntelligence(manager, getGame(manager, gameId));
		expect(before.openSlots).toBe(1);
		expect(before.fills.count).toBe(1);
		expect(before.benchNames).toEqual(expect.arrayContaining(['d Test', 'e Test']));

		const result = fillOpenSlots(manager, gameId);

		expect(result.filled).toBe(1);
		expect(result.intelligence.openSlots).toBe(0);
		expect(result.intelligence.fills.count).toBe(0);
		expect(result.intelligence.benchNames).toHaveLength(1);
		const snapshot = snapshotOf(gameId);
		expect(snapshot.warnings).toEqual([]);
		expect(snapshot.bench).toHaveLength(1);
		for (const entry of snapshot.bench) {
			expect(Object.keys(entry).sort()).toEqual(['kind', 'playerId', 'position']);
		}
		expect(
			sqlite.prepare("select count(*) as count from audit_log where action = 'game.fill'").get()
		).toMatchObject({ count: 1 });
	});

	it('places a claimed substitute in the position they claimed, not their native position', () => {
		addPlayer('a', { overall: 5 });
		addPlayer('b', { overall: 5 });
		addPlayer('c', { overall: 3 });
		addPlayer('s', { position: 'forward', substitute: true, overall: 4 });
		const gameId = addGame({
			roster: { forwardsPerTeam: 1, defensePerTeam: 1, goaliesPerTeam: 0 },
			assignments: {
				'white:forward:0': { playerId: 'a' },
				'black:forward:0': { playerId: 'b' },
				'black:defense:0': { playerId: 'c' }
			}
		});
		addClaim(gameId, 's', 'defense');

		const result = fillOpenSlots(manager, gameId);

		expect(result.filled).toBe(1);
		const game = getGame(manager, gameId);
		const slot = game.slots.find(
			(entry) => entry.team === 'white' && entry.position === 'defense'
		);
		expect(slot?.player).toMatchObject({ playerId: 's', kind: 'sub' });
	});

	it('reports unrated present players by name and never fills with them', () => {
		addPlayer('a', { overall: 5 });
		addPlayer('b', { overall: 5 });
		addPlayer('c', { overall: 1 });
		addPlayer('rated', { overall: 3 });
		addPlayer('unrated', { overall: 3, complete: false });
		const gameId = addGame({
			assignments: {
				'white:forward:0': { playerId: 'a' },
				'black:forward:0': { playerId: 'b' },
				'black:forward:1': { playerId: 'c' }
			}
		});
		setPresent(gameId, 'rated');
		setPresent(gameId, 'unrated');

		const result = fillOpenSlots(manager, gameId);

		expect(result.filled).toBe(1);
		expect(result.intelligence.unratedNames).toEqual(['unrated Test']);
	});

	it('keeps the unfilled-slots warning after a partial fill', () => {
		addPlayer('a', { overall: 5 });
		addPlayer('b', { overall: 5 });
		addPlayer('c', { overall: 3 });
		addPlayer('d', { overall: 3 });
		const gameId = addGame({
			roster: { forwardsPerTeam: 2, defensePerTeam: 0, goaliesPerTeam: 0 },
			assignments: {
				'white:forward:0': { playerId: 'a' },
				'black:forward:0': { playerId: 'b' }
			}
		});
		setPresent(gameId, 'd');

		const result = fillOpenSlots(manager, gameId);

		expect(result.filled).toBe(1);
		expect(result.intelligence.openSlots).toBe(1);
		expect(snapshotOf(gameId).warnings).toContain('unfilled-slots');
	});

	it('refuses to fill when nobody is available', () => {
		addPlayer('a', { overall: 5 });
		const gameId = addGame({ assignments: { 'white:forward:0': { playerId: 'a' } } });

		expect(captureError(() => fillOpenSlots(manager, gameId))).toMatchObject({
			code: 'CONFLICT',
			key: 'games.noOneToFill'
		});
	});

	it('recomputes the configured limit warning when saving', () => {
		h.settings = { ...h.settings, 'teams.maxSkillSpread': 0.1 };
		addPlayer('a', { overall: 5 });
		addPlayer('b', { overall: 1 });
		addPlayer('c', { overall: 3 });
		addPlayer('d', { overall: 5 });
		const gameId = addGame({
			assignments: {
				'white:forward:0': { playerId: 'a' },
				'white:forward:1': { playerId: 'b' },
				'black:forward:0': { playerId: 'c' }
			}
		});
		setPresent(gameId, 'd');

		fillOpenSlots(manager, gameId);

		const snapshot = snapshotOf(gameId);
		expect(snapshot.skillDiff).toBe(1);
		expect(snapshot.warnings).toContain('rule-limit');
	});
});

describe('lineup intelligence states', () => {
	it('returns an explicit incomplete state for a one-sided lineup', () => {
		addPlayer('a', { overall: 5 });
		const gameId = addGame({ assignments: { 'white:forward:0': { playerId: 'a' } } });

		const intelligence = lineupIntelligence(manager, getGame(manager, gameId));

		expect(intelligence.complete).toBe(false);
		expect(intelligence.skillDiff).toBeNull();
		expect(intelligence.sizeDiff).toBe(1);
		expect(intelligence.swap).toBeNull();
		expect(intelligence.sizes).toEqual({ white: 1, black: 0 });
		expect(intelligence.averages).toEqual({ white: 5, black: null });
	});
});

describe('applyBestSwap through the service', () => {
	it('never introduces a strict violation while repairing a preference', () => {
		for (const [id, overall] of [
			['pa', 5],
			['ya', 4],
			['qb', 1],
			['xb', 2]
		] as const) {
			addPlayer(id, { overall });
		}
		const gameId = addGame({
			roster: forwardsOnly,
			assignments: {
				'white:forward:0': { playerId: 'pa' },
				'white:forward:1': { playerId: 'ya' },
				'black:forward:0': { playerId: 'qb' },
				'black:forward:1': { playerId: 'xb' }
			}
		});
		addRule('xb', 'ya', 'must', false);
		addRule('pa', 'qb', 'must_not', true);

		const before = lineupIntelligence(manager, getGame(manager, gameId));
		expect(before.swap).toMatchObject({ playerAId: 'pa', playerBId: 'qb' });

		const result = applyBestSwap(manager, gameId);
		expect(result.skillDiff).toBe(1);
		const game = getGame(manager, gameId);
		const teamOf = new Map(
			game.slots
				.filter((slot) => slot.player)
				.map((slot) => [slot.player!.playerId, slot.team])
		);
		expect(teamOf.get('pa')).not.toBe(teamOf.get('qb'));
		expect(
			sqlite.prepare("select count(*) as count from audit_log where action = 'game.swap'").get()
		).toMatchObject({ count: 1 });
	});

	it('refuses a swap when no exchange improves the lineup', () => {
		for (const id of ['a', 'b', 'c', 'd']) addPlayer(id, { overall: 4 });
		const gameId = addGame({
			roster: forwardsOnly,
			assignments: {
				'white:forward:0': { playerId: 'a' },
				'white:forward:1': { playerId: 'b' },
				'black:forward:0': { playerId: 'c' },
				'black:forward:1': { playerId: 'd' }
			}
		});

		expect(captureError(() => applyBestSwap(manager, gameId))).toMatchObject({
			code: 'CONFLICT',
			key: 'games.noBetterSwap'
		});
	});
});

describe('lineup rating purge', () => {
	it('removes the ratings of a player dropped from the lineup and audits their id', () => {
		addPlayer('a', { overall: 4 });
		addPlayer('b', { overall: 4 });
		addPlayer('c', { overall: 3 });
		const gameId = addGame({
			assignments: {
				'white:forward:0': { playerId: 'a' },
				'white:forward:1': { playerId: 'b' }
			}
		});
		addGameRatings(gameId, 'a', 'forward', 4);
		addGameRatings(gameId, 'b', 'forward', 3);
		addGameRatings(gameId, 'c', 'forward', 2);
		setPresent(gameId, 'a');
		setPresent(gameId, 'b', 'absent');
		setPresent(gameId, 'c');

		regenerateAsAdmin(admin, gameId);

		expect(gameRatingRows(gameId, 'b')).toEqual([]);
		expect(gameRatingRows(gameId, 'a')).toHaveLength(4);
		expect(gameRatingRows(gameId, 'a').every((row) => row.value === 4)).toBe(true);
		expect(gameRatingRows(gameId, 'c').every((row) => row.value === 2)).toBe(true);
		const cleanup = sqlite
			.prepare(
				"select metadata_json from audit_log where action = 'ratings.game_removed'"
			)
			.get() as { metadata_json: string };
		expect(JSON.parse(cleanup.metadata_json)).toEqual({ playerIds: ['b'] });

		sqlite.prepare("update games set status = 'completed', completed_at = 1 where id = ?").run(gameId);
		saveGameAssessment(admin, gameId, 'a', {
			impact: 5,
			effort: 5,
			decisions: 5,
			discipline: 5
		});

		expect(gameRatingRows(gameId, 'b')).toEqual([]);
		const kept = gameRatingRows(gameId, 'a');
		expect(kept).toHaveLength(4);
		expect(kept.every((row) => row.value === 5)).toBe(true);
		expect(gameRatingRows(gameId, 'c').every((row) => row.value === 2)).toBe(true);
	});
});

describe('validation partagée des alignements', () => {
	const known = [
		{ team: 'white' as const, position: 'forward' as const, slotIndex: 0 },
		{ team: 'white' as const, position: 'forward' as const, slotIndex: 1 }
	];
	const names = new Map([['a', 'Alice'], ['b', 'Bob']]);

	it('refuse une place inconnue et une place écrite deux fois', () => {
		expect(
			captureError(() =>
				validateAssignments(
					known,
					[{ team: 'white', position: 'forward', slotIndex: 2, playerId: 'a' }],
					names
				)
			)
		).toMatchObject({ code: 'VALIDATION', key: 'games.lineupSlotUnknown' });

		expect(
			captureError(() =>
				validateAssignments(
					known,
					[
						{ team: 'white', position: 'forward', slotIndex: 0, playerId: 'a' },
						{ team: 'white', position: 'forward', slotIndex: 0, playerId: 'b' }
					],
					names
				)
			)
		).toMatchObject({ code: 'VALIDATION', key: 'games.lineupSlotUnknown' });
	});

	it('refuse un joueur deux fois avec son nom, comme le chemin manuel', () => {
		expect(
			captureError(() =>
				validateAssignments(
					known,
					[
						{ team: 'white', position: 'forward', slotIndex: 0, playerId: 'a' },
						{ team: 'white', position: 'forward', slotIndex: 1, playerId: 'a' }
					],
					names
				)
			)
		).toMatchObject({
			code: 'VALIDATION',
			key: 'games.lineupPlayerDuplicate',
			params: { name: 'Alice' }
		});
	});

	it('retourne les places écrites quand tout est valide', () => {
		expect(
			validateAssignments(
				known,
				[
					{ team: 'white', position: 'forward', slotIndex: 0, playerId: 'a' },
					{ team: 'white', position: 'forward', slotIndex: 1, playerId: 'b' }
				],
				names
			)
		).toEqual(new Set(['white:forward:0', 'white:forward:1']));
	});
});
