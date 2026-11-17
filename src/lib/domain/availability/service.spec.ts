import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import type { Actor } from '#lib/domain/auth/types.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';

/**
 * La réponse de présence est une seule transaction. Une panne entre la
 * présence, la place et la demande ne doit jamais laisser un absent sans
 * demande; un nouvel essai repart de l'état validé et ne crée qu'une demande.
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
const { markAvailability, availabilityForGame } = await import('./service.ts');
const { cancelOwnRequest } = await import('#lib/domain/subs/service.ts');

const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'me',
	name: 'Moi',
	role: 'player'
};

const substitute: Actor = {
	kind: 'user',
	active: true,
	userId: 'sub',
	name: 'Remplaçant',
	role: 'player'
};

const TEMPLATE = JSON.stringify({
	goaliesPerTeam: 0,
	forwardsPerTeam: 1,
	defensePerTeam: 0
});

const games: Record<string, GameSummary> = {
	open: {
		id: 'open',
		gameDate: '2026-11-20',
		startTime: '09:00',
		locationId: 'arena',
		location: 'Aréna',
		status: 'scheduled'
	},
	locked: {
		id: 'locked',
		gameDate: '2026-11-17',
		startTime: '18:00',
		locationId: 'arena',
		location: 'Aréna',
		status: 'scheduled'
	},
	started: {
		id: 'started',
		gameDate: '2026-11-16',
		startTime: '09:00',
		locationId: 'arena',
		location: 'Aréna',
		status: 'scheduled'
	}
};

function auditRows() {
	return sqlite
		.prepare('select action, metadata_json from audit_log order by rowid')
		.all() as { action: string; metadata_json: string | null }[];
}

function presence(gameId: string, playerId: string) {
	return sqlite
		.prepare(
			'select status from game_availability where game_id = ? and player_id = ?'
		)
		.get(gameId, playerId) as { status: string } | undefined;
}

function slotOwner(gameId: string): string | null {
	const row = sqlite
		.prepare(
			`select assigned_player_id from game_slots
			 where game_id = ? and position = ? order by slot_index limit 1`
		)
		.get(gameId, 'forward') as { assigned_player_id: string | null } | undefined;
	return row?.assigned_player_id ?? null;
}

function slotAt(gameId: string, slotIndex: number): string | null {
	const row = sqlite
		.prepare(
			`select assigned_player_id from game_slots
			 where game_id = ? and position = 'forward' and slot_index = ?`
		)
		.get(gameId, slotIndex) as { assigned_player_id: string | null } | undefined;
	return row?.assigned_player_id ?? null;
}

function requestCount(gameId: string): number {
	const row = sqlite
		.prepare('select count(*) as count from sub_requests where game_id = ?')
		.get(gameId) as { count: number };
	return row.count;
}

function requestIds(gameId: string): string[] {
	return (
		sqlite
			.prepare('select id from sub_requests where game_id = ? order by created_at')
			.all(gameId) as { id: string }[]
	).map((row) => row.id);
}

function jobCount(eventKey: string): number {
	const row = sqlite
		.prepare(
			`select count(*) as count from notification_jobs
			 where event_key = ? and channel = 'in_app'`
		)
		.get(eventKey) as { count: number };
	return row.count;
}

function failLastAudit(): void {	sqlite
		.prepare(
			`create trigger fail_availability_audit before insert on audit_log
			 when new.action = 'availability.set'
			 begin select raise(abort, 'audit failed'); end;`
		)
		.run();
}

function refusal(run: () => unknown): unknown {
	try {
		run();
	} catch (cause) {
		return cause;
	}
	return null;
}

function addPresence(gameId: string, playerId: string, status: 'present' | 'absent') {
	sqlite
		.prepare(
			`insert into game_availability (game_id, player_id, status, updated_at)
			 values (?, ?, ?, 0)`
		)
		.run(gameId, playerId, status);
}

function addSlot(gameId: string, playerId: string, index: number): void {
	sqlite
		.prepare(
			`insert into game_slots
			 (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values (?, ?, 'white', 'forward', ?, ?, 'regular', 0, 0)`
		)
		.run(`${gameId}-${index}`, gameId, index, playerId);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 0, 0));
	sqlite.prepare('drop trigger if exists fail_availability_audit').run();
	for (const table of [
		'notification_jobs',
		'notification_preferences',
		'audit_log',
		'sub_requests',
		'sub_profiles',
		'game_player_ratings',
		'game_slots',
		'game_availability',
		'games',
		'locations',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	for (const [id, role] of [
		['me', 'player'],
		['sub', 'player']
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
			 (user_id, first_name, last_name, position, age, is_substitute, active, created_at, updated_at)
			 values ('me', 'Moi', 'Test', 'forward', 30, 0, 1, 0, 0),
			        ('sub', 'Remplaçant', 'Test', 'forward', 30, 1, 1, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into sub_profiles (player_id, favorite, positions_json, created_at, updated_at)
			 values ('sub', 0, '["forward"]', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at)
			 values ('arena', 'Aréna', 0, 0)`
		)
		.run();
	for (const game of Object.values(games)) {
		sqlite
			.prepare(
				`insert into games
				 (id, game_date, start_time, location_id, location, status,
				  roster_template_json, created_at, updated_at)
				 values (?, ?, ?, 'arena', 'Aréna', 'scheduled', ?, 0, 0)`
			)
			.run(game.id, game.gameDate, game.startTime, TEMPLATE);
		addSlot(game.id, 'me', 0);
	}
});

describe('réponse de présence atomique', () => {
	it('garde l’orchestration et la transaction dans le service', () => {
		const source = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');

		expect(source).toContain('db.transaction');
		expect(source).toContain('writePresenceIn');
		expect(source).not.toContain("from './queries.ts'");
		expect(existsSync(new URL('./queries.ts', import.meta.url))).toBe(false);
	});

	it('écrit présence, place, demande et traces ensemble', () => {
		addPresence('open', 'me', 'present');

		const result = markAvailability(player, 'open', 'absent');

		expect(result.requestCreated).toBe(true);
		expect(result.messageKey).toBe('availability.savedRequested');
		expect(presence('open', 'me')).toEqual({ status: 'absent' });
		expect(slotOwner('open')).toBeNull();
		expect(requestCount('open')).toBe(1);
		const [request] = sqlite
			.prepare('select reason, status, position, requested_by_player_id from sub_requests where game_id = ?')
			.all('open') as {
			reason: string;
			status: string;
			position: string;
			requested_by_player_id: string;
		}[];
		expect(request).toEqual({
			reason: 'absence',
			status: 'open',
			position: 'forward',
			requested_by_player_id: 'me'
		});
		expect(auditRows().map((row) => row.action)).toEqual([
			'game.lineup_release',
			'sub.request_created',
			'availability.set'
		]);
		expect(jobCount('sub_request')).toBeGreaterThan(0);
	});

	it('annule tout si la dernière trace échoue, puis crée une seule demande', () => {
		addPresence('open', 'me', 'present');
		failLastAudit();

		expect(() => markAvailability(player, 'open', 'absent')).toThrow();

		expect(presence('open', 'me')).toEqual({ status: 'present' });
		expect(slotOwner('open')).toBe('me');
		expect(requestCount('open')).toBe(0);
		expect(auditRows()).toEqual([]);

		sqlite.prepare('drop trigger fail_availability_audit').run();
		const retry = markAvailability(player, 'open', 'absent');

		expect(retry.requestCreated).toBe(true);
		expect(requestCount('open')).toBe(1);
		expect(auditRows().map((row) => row.action)).toEqual([
			'game.lineup_release',
			'sub.request_created',
			'availability.set'
		]);

		const again = markAvailability(player, 'open', 'absent');
		expect(again.requestCreated).toBe(false);
		expect(requestCount('open')).toBe(1);
	});

	it('recrée une demande après son annulation et notifie chaque vague', () => {
		addPresence('open', 'me', 'present');
		const first = markAvailability(player, 'open', 'absent');
		const firstId = requestIds('open')[0]!;
		const firstJobs = jobCount('sub_request');
		expect(first.requestCreated).toBe(true);

		cancelOwnRequest(player, games.open, firstId);
		markAvailability(player, 'open', 'present');
		const second = markAvailability(player, 'open', 'absent');

		expect(second.requestCreated).toBe(true);
		expect(requestCount('open')).toBe(2);
		expect(requestIds('open')[1]).not.toBe(firstId);
		expect(jobCount('sub_request')).toBe(firstJobs * 2);
	});

	it('rend la place du remplaçant quand le joueur revient', () => {
		addPresence('open', 'me', 'absent');
		addSlot('open', 'sub', 1);
		sqlite
			.prepare(
				`insert into sub_requests
				 (id, game_id, requested_by_player_id, position, reason, status, created_at,
				  filled_by_player_id, filled_at)
				 values ('request', 'open', 'me', 'forward', 'absence', 'filled', 0, 'sub', 0)`
			)
			.run();

		const result = markAvailability(player, 'open', 'present');

		expect(result.bumpedPlayerId).toBe('sub');
		expect(result.messageKey).toBe('availability.savedBumped');
		expect(presence('open', 'me')).toEqual({ status: 'present' });
		expect(slotAt('open', 0)).toBe('me');
		expect(slotAt('open', 1)).toBeNull();
		const release = sqlite
			.prepare(
				"select metadata_json from audit_log where action = 'game.lineup_release'"
			)
			.get() as { metadata_json: string };
		expect(JSON.parse(release.metadata_json)).toEqual({
			playerId: 'sub',
			reason: 'bumped'
		});
		const request = sqlite
			.prepare("select status, cancelled_at from sub_requests where id = 'request'")
			.get() as { status: string; cancelled_at: number | null };
		expect(request.status).toBe('cancelled');
		expect(request.cancelled_at).not.toBeNull();
		expect(auditRows().map((row) => row.action)).toEqual([
			'sub.request_cancelled',
			'game.lineup_release',
			'availability.set'
		]);
		expect(jobCount('sub_bumped')).toBeGreaterThan(0);
	});
});

describe('fenêtres de présence', () => {
	it('refuse une présence après la fermeture mais accepte le retrait', () => {
		addPresence('locked', 'me', 'present');

		expect(refusal(() => markAvailability(player, 'locked', 'present'))).toMatchObject({
			code: 'CONFLICT',
			key: 'availability.locked'
		});
		const result = markAvailability(player, 'locked', 'absent');

		expect(result.requestCreated).toBe(true);
		expect(presence('locked', 'me')).toEqual({ status: 'absent' });
	});

	it('refuse les deux réponses après la mise au jeu', () => {
		addPresence('started', 'me', 'present');

		for (const status of ['present', 'absent'] as const) {
			expect(refusal(() => markAvailability(player, 'started', status))).toMatchObject({
				code: 'CONFLICT',
				key: 'availability.gameClosed'
			});
		}
		expect(presence('started', 'me')).toEqual({ status: 'present' });
	});

	it('refuse une réponse de remplaçant', () => {
		expect(refusal(() => markAvailability(substitute, 'open', 'absent'))).toMatchObject({
			code: 'FORBIDDEN',
			key: 'availability.substituteNoConfirm'
		});
	});

	it('ne montre plus le retrait une fois le match commencé', () => {
		const view = availabilityForGame(player, games.started);
		expect(view.canWithdraw).toBe(false);
	});
});
