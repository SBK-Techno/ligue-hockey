import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';

/**
 * Chaque réclamation et chaque réouverture doit produire ses propres avis :
 * un remplaçant qui prend, relâche puis reprend la même place, et une demande
 * rouverte le même jour, ne peuvent pas être avalés par une clé constante.
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
const { claimSubstitute, releaseSubstitute, createAbsenceRequest, cancelOwnRequest } =
	await import('./service.ts');

const game: GameSummary = {
	id: 'game',
	gameDate: '2026-11-20',
	startTime: '09:00',
	locationId: 'arena',
	location: 'Aréna',
	status: 'scheduled'
};

const substitute: Actor = {
	kind: 'user',
	active: true,
	userId: 'sub',
	name: 'Remplaçant',
	role: 'player'
};

const requester: Actor = {
	kind: 'user',
	active: true,
	userId: 'requester',
	name: 'Demandeur',
	role: 'player'
};

const requesterProfile = {
	userId: 'requester',
	firstName: 'Demandeur',
	lastName: 'Test',
	fullName: 'Demandeur Test',
	position: 'forward' as const,
	jerseyNumber: 9,
	avatarId: null,
	isSubstitute: false,
	active: true,
	email: 'requester@example.test',
	age: 30
};

const TEMPLATE = JSON.stringify({
	goaliesPerTeam: 0,
	forwardsPerTeam: 2,
	defensePerTeam: 0
});

function jobCount(eventKey: string): number {
	const row = sqlite
		.prepare(
			`select count(*) as count from notification_jobs
			 where event_key = ? and channel = 'in_app'`
		)
		.get(eventKey) as { count: number };
	return row.count;
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 0, 0));
	for (const table of [
		'notification_jobs',
		'notification_preferences',
		'audit_log',
		'sub_requests',
		'sub_profiles',
		'game_slots',
		'games',
		'locations',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	for (const [id, role] of [
		['manager', 'manager'],
		['requester', 'player'],
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
			 values ('requester', 'Demandeur', 'Test', 'forward', 30, 0, 1, 0, 0),
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
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status,
			  roster_template_json, created_at, updated_at)
			 values ('game', '2026-11-20', '09:00', 'arena', 'Aréna', 'scheduled', ?, 0, 0)`
		)
		.run(TEMPLATE);
	sqlite
		.prepare(
			`insert into sub_requests
			 (id, game_id, requested_by_player_id, position, reason, status, created_at)
			 values ('request', 'game', 'requester', 'forward', 'manual', 'open', 0)`
		)
		.run();
});

describe('avis de remplacement', () => {
	it('notifie chaque réclamation distincte', () => {
		claimSubstitute(substitute, game, 'request');
		const afterFirst = jobCount('sub_claimed');
		expect(afterFirst).toBeGreaterThan(0);

		const wavesBefore = jobCount('sub_request');
		releaseSubstitute(substitute, game, 'request');
		expect(jobCount('sub_request')).toBeGreaterThan(wavesBefore);

		vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 1, 0));
		claimSubstitute(substitute, game, 'request');

		expect(jobCount('sub_claimed')).toBe(afterFirst * 2);
	});

	it('notifie une demande rouverte le même jour', () => {
		sqlite.prepare("delete from sub_requests where game_id = 'game'").run();

		const first = createAbsenceRequest(
			requester,
			{ ...game, id: 'game' },
			requesterProfile
		);
		expect(first).not.toBeNull();
		const afterFirst = jobCount('sub_request');
		expect(afterFirst).toBeGreaterThan(0);

		cancelOwnRequest(requester, game, first!.id);

		const second = createAbsenceRequest(requester, game, requesterProfile);
		expect(second).not.toBeNull();
		expect(second!.id).not.toBe(first!.id);
		expect(jobCount('sub_request')).toBe(afterFirst * 2);
	});
});
