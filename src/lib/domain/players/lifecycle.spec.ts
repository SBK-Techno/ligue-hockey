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

const h = vi.hoisted(() => ({
	revokeSessions: vi.fn(async () => undefined),
	updateName: vi.fn(async () => undefined),
	regenerate: vi.fn(),
	logError: vi.fn()
}));

vi.mock('../auth/identity.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('../auth/identity.ts')>();
	return {
		...original,
		identity: () => ({
			createUser: vi.fn(),
			deleteUser: vi.fn(),
			updateName: h.updateName,
			setRole: vi.fn(),
			revokeSessions: h.revokeSessions,
			requestPasswordReset: vi.fn()
		})
	};
});

vi.mock('#lib/domain/games/upcoming.ts', () => ({
	regenerateUpcomingGeneratedGames: h.regenerate
}));

vi.mock('#lib/shared/logging/logger.ts', () => ({
	logger: {
		error: h.logError,
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn()
	}
}));

const { sqlite } = await import('#lib/server/db/index.ts');
const { adminUpdatePlayer, updateOwnProfile } = await import('./service.ts');
const { updateOwnProfileSchema } = await import('./validators.ts');
const { actorFromUser, anonymousActor } = await import('#lib/domain/auth/types.ts');
const { can } = await import('#lib/domain/auth/policy.ts');
const { claimSubstitute } = await import('#lib/domain/subs/service.ts');
const { getGame } = await import('#lib/domain/games/service.ts');

const NOW = 1_700_000_000_000;
const SNAPSHOT = JSON.stringify({
	skillDiff: null,
	ageDiff: 0,
	sizeDiff: 0,
	warnings: [],
	ruleViolations: [],
	bench: [
		{ playerId: 'manager', position: 'forward', kind: 'regular' },
		{ playerId: 'other', position: 'forward', kind: 'regular' }
	],
	candidateKey: '',
	generatedAt: 1
});

const admin: Actor = {
	kind: 'user',
	userId: 'admin',
	name: 'Admin',
	role: 'admin',
	active: true
};

function addUser(id: string, role: 'player' | 'manager' | 'admin' = 'player'): void {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values (?, ?, ?, 1, ?, ?, ?)`
		)
		.run(id, id, `${id}@example.test`, NOW, NOW, role);
}

function addPlayer(
	id: string,
	options: {
		role?: 'player' | 'manager' | 'admin';
		position?: 'forward' | 'defense' | 'goalie';
		active?: boolean;
		isSubstitute?: boolean;
	} = {}
): void {
	addUser(id, options.role ?? 'player');
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, avatar_id, is_substitute, active, created_at, updated_at)
			 values (?, ?, 'Test', ?, 30, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			id,
			options.position ?? 'forward',
			`face-${id}`,
			options.isSubstitute ? 1 : 0,
			options.active === false ? 0 : 1,
			NOW,
			NOW
		);
}

function addGame(
	id: string,
	date: string,
	status: 'scheduled' | 'completed',
	snapshot: string | null = null
): void {
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, completed_at,
			  roster_template_json, generated_at, generation_json, created_at, updated_at)
			 values (?, ?, '09:00', 'arena', 'Aréna', ?, ?, '{}', ?, ?, ?, ?)`
		)
		.run(
			id,
			date,
			status,
			status === 'completed' ? 1 : null,
			snapshot ? 1 : null,
			snapshot,
			NOW,
			NOW
		);
}

function assign(gameId: string, playerId: string): void {
	sqlite
		.prepare(
			`insert into game_slots
			 (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values (?, ?, 'white', 'forward', 0, ?, 'regular', ?, ?)`
		)
		.run(`${gameId}-${playerId}`, gameId, playerId, NOW, NOW);
}

beforeEach(() => {
	for (const table of [
		'game_player_ratings',
		'game_goals',
		'game_penalties',
		'game_availability',
		'sub_requests',
		'game_slots',
		'games',
		'locations',
		'players',
		'audit_log',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`)
		.run();
	h.revokeSessions.mockClear();
	h.updateName.mockClear();
	h.regenerate.mockClear();
	h.logError.mockClear();
});

describe('désactivation d’un joueur', () => {
	it('révoque les sessions et retire le joueur des engagements futurs', async () => {
		addPlayer('admin', { role: 'admin' });
		addPlayer('manager', { role: 'manager' });
		addPlayer('other');
		addPlayer('sub', { isSubstitute: true });
		addGame('future', '2099-01-04', 'scheduled', SNAPSHOT);
		addGame('past', '2020-01-05', 'completed');
		assign('future', 'manager');
		assign('past', 'manager');
		sqlite
			.prepare(
				`insert into game_availability (game_id, player_id, status, updated_at)
				 values ('future', 'manager', 'present', ?)`
			)
			.run(NOW);
		sqlite
			.prepare(
				`insert into sub_requests
				 (id, game_id, requested_by_player_id, position, reason, status, created_at, filled_by_player_id, filled_at)
				 values ('request', 'future', 'other', 'forward', 'absence', 'filled', ?, 'manager', ?)`
			)
			.run(NOW, NOW);

		await adminUpdatePlayer(admin, 'manager', { active: false });

		expect(h.revokeSessions).toHaveBeenCalledWith('manager');
		expect(h.regenerate).toHaveBeenCalledTimes(1);

		const player = sqlite
			.prepare('select active from players where user_id = ?')
			.get('manager') as { active: number };
		expect(player.active).toBe(0);

		const futureSlot = sqlite
			.prepare("select assigned_player_id, assignment_kind from game_slots where game_id = 'future'")
			.get() as { assigned_player_id: string | null; assignment_kind: string | null };
		expect(futureSlot).toEqual({ assigned_player_id: null, assignment_kind: null });

		const pastSlot = sqlite
			.prepare("select assigned_player_id from game_slots where game_id = 'past'")
			.get() as { assigned_player_id: string | null };
		expect(pastSlot.assigned_player_id).toBe('manager');

		const attendance = sqlite
			.prepare("select count(*) as count from game_availability where player_id = 'manager'")
			.get() as { count: number };
		expect(attendance.count).toBe(0);

		const request = sqlite
			.prepare("select status, filled_by_player_id from sub_requests where id = 'request'")
			.get() as { status: string; filled_by_player_id: string | null };
		expect(request).toEqual({ status: 'open', filled_by_player_id: null });

		const game = getGame(admin, 'future');
		expect(game.generation?.bench.map((entry) => entry.playerId)).toEqual(['other']);
	});

	it('rend le compte anonyme et refuse les capacités au prochain acteur', () => {
		const inactive = actorFromUser({
			id: 'manager',
			name: 'Gérante',
			role: 'manager',
			active: false
		});

		expect(inactive).toEqual(anonymousActor);
		expect(can(inactive, 'manageGames')).toBe(false);
	});

	it('refuse l’auto-désactivation', async () => {
		addPlayer('admin', { role: 'admin' });

		await expect(adminUpdatePlayer(admin, 'admin', { active: false })).rejects.toMatchObject({
			key: 'admin.deactivateSelf'
		});
		expect(h.revokeSessions).not.toHaveBeenCalled();
	});

	it('refuse de désactiver le dernier administrateur actif', async () => {
		addUser('root', 'admin');
		addPlayer('last-admin', { role: 'admin' });

		await expect(
			adminUpdatePlayer(
				{ kind: 'user', userId: 'root', name: 'Root', role: 'admin', active: true },
				'last-admin',
				{ active: false }
			)
		).rejects.toMatchObject({ key: 'admin.deactivateLastAdmin' });
	});

	it('empêche un remplaçant désactivé de réclamer une place', () => {
		addPlayer('sub', { isSubstitute: true, active: false });
		sqlite
			.prepare(
				`insert into games
				 (id, game_date, start_time, location_id, location, status, roster_template_json, created_at, updated_at)
				 values ('future', '2099-01-04', '09:00', 'arena', 'Aréna', 'scheduled', '{}', ?, ?)`
			)
			.run(NOW, NOW);
		sqlite
			.prepare(
				`insert into sub_requests
				 (id, game_id, position, reason, status, created_at)
				 values ('open', 'future', 'forward', 'manual', 'open', ?)`
			)
			.run(NOW);

		let caught: unknown;
		try {
			claimSubstitute(
				{ kind: 'user', userId: 'sub', name: 'Sub', role: 'player', active: true },
				{
					id: 'future',
					gameDate: '2099-01-04',
					startTime: '09:00',
					locationId: 'arena',
					location: 'Aréna',
					status: 'scheduled'
				},
				'open'
			);
		} catch (error) {
			caught = error;
		}
		expect(caught).toMatchObject({ key: 'subs.notEligible' });
	});
});

describe('synchronisation du nom', () => {
	const playerActor: Actor = {
		kind: 'user',
		userId: 'player',
		name: 'player',
		role: 'player',
		active: true
	};

	it('garde la fiche, journalise l’échec et réessaie à la prochaine sauvegarde', async () => {
		addPlayer('player');
		h.updateName.mockRejectedValueOnce(new Error('identity down'));

		await updateOwnProfile(playerActor, {
			firstName: 'Nouveau',
			lastName: 'Nom',
			age: 31,
			jerseyNumber: null
		});

		expect(
			sqlite
				.prepare(`select first_name as firstName from players where user_id = 'player'`)
				.get()
		).toEqual({ firstName: 'Nouveau' });
		expect(h.logError).toHaveBeenCalledWith(
			'players.name_sync_failed',
			expect.objectContaining({ userId: 'player' })
		);

		await updateOwnProfile(playerActor, {
			firstName: 'Nouveau',
			lastName: 'Nom',
			age: 31,
			jerseyNumber: null
		});
		expect(h.updateName).toHaveBeenCalledTimes(2);
	});
});

describe('poste du joueur', () => {
	it('ignore un poste envoyé par la fiche personnelle', async () => {
		addPlayer('player');
		const parsed = updateOwnProfileSchema.parse({
			firstName: 'Nouveau',
			lastName: 'Nom',
			age: 31,
			jerseyNumber: null,
			position: 'goalie'
		});
		expect(parsed).not.toHaveProperty('position');

		await updateOwnProfile(
			{
				kind: 'user',
				userId: 'player',
				name: 'player',
				role: 'player',
				active: true
			},
			parsed
		);

		expect(
			sqlite
				.prepare(`select position from players where user_id = 'player'`)
				.get()
		).toEqual({ position: 'forward' });
	});
});
