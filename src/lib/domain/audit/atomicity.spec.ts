import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

/**
 * Une écriture et sa trace d'audit sont une seule transaction : si l'audit
 * échoue, l'écriture ne doit pas rester en base. Ce test passe par les cas
 * d'usage réels et provoque l'échec avec un déclencheur SQLite sur `audit_log`.
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
const { createPoll, closePollAsAdmin, deleteChatMessage } = await import(
	'#lib/domain/chat/service.ts'
);
const {
	cancelOwnRequest,
	claimSubstitute,
	createManualRequest,
	releaseSubstitute,
	setSubstituteFavorite
} = await import('#lib/domain/subs/service.ts');
const { markAvailability } = await import('#lib/domain/availability/service.ts');
const { saveGameAssessment, setRatings } = await import('#lib/domain/ratings/service.ts');
const { setPlayerRole } = await import('#lib/domain/players/service.ts');
const { provideIdentity } = await import('#lib/domain/auth/identity.ts');
import type { IdentityProvider } from '#lib/domain/auth/identity.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';

const admin: Actor = {
	kind: 'user',
	active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

const author: Actor = {
	kind: 'user',
	active: true,
	userId: 'author',
	name: 'Auteur',
	role: 'player'
};

const regular: Actor = {
	kind: 'user',
	active: true,
	userId: 'regular',
	name: 'Régulier',
	role: 'player'
};

const game: GameSummary = {
	id: 'game',
	gameDate: '2099-01-04',
	startTime: '09:00',
	locationId: 'arena',
	location: 'Aréna',
	status: 'scheduled'
};

const TEMPLATE = JSON.stringify({
	goaliesPerTeam: 0,
	forwardsPerTeam: 2,
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

function failAudit(): void {
	sqlite
		.prepare(
			`create trigger fail_audit before insert on audit_log
			 begin select raise(abort, 'audit failed'); end;`
		)
		.run();
}

beforeEach(() => {
	sqlite.prepare('drop trigger if exists fail_audit').run();
	for (const table of [
		'notification_jobs',
		'notification_preferences',
		'poll_votes',
		'poll_options',
		'polls',
		'chat_messages',
		'sub_profiles',
		'sub_requests',
		'player_ratings',
		'game_player_ratings',
		'game_availability',
		'game_slots',
		'games',
		'locations',
		'audit_log',
		'league_settings',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	for (const [id, role] of [
		['admin', 'admin'],
		['author', 'player'],
		['regular', 'player']
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
			 values ('author', 'Auteur', 'Test', 'forward', 30, 1, 1, 0, 0),
			        ('regular', 'Régulier', 'Test', 'forward', 30, 0, 1, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into chat_messages (id, author_user_id, kind, body, created_at)
			 values ('message', 'author', 'text', 'Bonjour', 0)`
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
			 values ('game', '2099-01-04', '09:00', 'arena', 'Aréna', 'scheduled', ?, 0, 0)`
		)
		.run(TEMPLATE);
	sqlite
		.prepare(
			`insert into games
			 (id, game_date, start_time, location_id, location, status, completed_at,
			  roster_template_json, generated_at, generation_json, created_at, updated_at)
			 values ('past', '2020-01-05', '09:00', 'arena', 'Aréna', 'completed', 1, ?, 1, ?, 0, 0)`
		)
		.run(TEMPLATE, SNAPSHOT);
	sqlite
		.prepare(
			`insert into game_slots
			 (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
			 values ('past-slot', 'past', 'white', 'forward', 0, 'author', 'regular', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into game_availability (game_id, player_id, status, updated_at)
			 values ('game', 'regular', 'present', 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into sub_requests
			 (id, game_id, requested_by_player_id, position, reason, status, created_at,
			  filled_by_player_id, filled_at)
			 values ('claim', 'game', null, 'forward', 'manual', 'open', 0, null, null),
			        ('own', 'game', 'regular', 'forward', 'manual', 'open', 0, null, null),
			        ('filled', 'game', 'author', 'forward', 'manual', 'filled', 0, 'regular', 0)`
		)
		.run();
	provideIdentity({
		createUser: vi.fn(async () => ({ id: 'new' })),
		updateName: vi.fn(async () => undefined),
		deleteUser: vi.fn(async () => undefined),
		setAccountState: vi.fn(async () => undefined),
		revokeSessions: vi.fn(async () => undefined),
		requestPasswordReset: vi.fn(async () => undefined),
		signIn: vi.fn(async () => undefined),
		changePassword: vi.fn(async () => undefined),
		resetPassword: vi.fn(async () => undefined),
		// Le port de HEAD écrivait le rôle par le fournisseur; le faux le
		// reproduit pour que la comparaison avant/après reste honnête.
		setRole: vi.fn(async (userId: string, role: string) => {
			sqlite.prepare('update user set role = ? where id = ?').run(role, userId);
		})
	} as unknown as IdentityProvider);
});

describe('audit atomique', () => {
	it('annule un sondage quand sa trace échoue', () => {
		failAudit();

		expect(() =>
			createPoll(admin, { question: 'On joue ?', options: ['Oui', 'Non'] })
		).toThrow();

		expect(
			sqlite.prepare("select count(*) as count from polls").get()
		).toEqual({ count: 0 });
		expect(
			sqlite
				.prepare("select count(*) as count from chat_messages where kind = 'poll'")
				.get()
		).toEqual({ count: 0 });
	});

	it('laisse un sondage ouvert quand la fermeture échoue à s’auditer', () => {
		const messageId = createPoll(admin, { question: 'On joue ?', options: ['Oui', 'Non'] });
		failAudit();

		expect(() => closePollAsAdmin(admin, messageId)).toThrow();

		expect(
			sqlite.prepare('select closes_at from polls where message_id = ?').get(messageId)
		).toEqual({ closes_at: null });
	});

	it('n’efface pas un message quand sa trace échoue', () => {
		failAudit();

		expect(() => deleteChatMessage(admin, 'message')).toThrow();

		expect(
			sqlite.prepare("select deleted_at from chat_messages where id = 'message'").get()
		).toEqual({ deleted_at: null });
	});

	it('ne garde pas une préférence de remplaçant sans sa trace', () => {
		failAudit();

		expect(() =>
			setSubstituteFavorite(admin, { playerId: 'author', favorite: true })
		).toThrow();

		expect(
			sqlite.prepare("select count(*) as count from sub_profiles where player_id = 'author'").get()
		).toEqual({ count: 0 });
	});

	it('ne change pas un rôle quand sa trace échoue', async () => {
		failAudit();

		await expect(setPlayerRole(admin, 'author', 'admin')).rejects.toThrow();

		expect(sqlite.prepare("select role from user where id = 'author'").get()).toEqual({
			role: 'player'
		});
	});

	it('ne garde pas une absence sans sa demande ni sa trace', () => {
		failAudit();

		expect(() => markAvailability(regular, 'game', 'absent')).toThrow();

		expect(
			sqlite
				.prepare("select status from game_availability where game_id = 'game' and player_id = 'regular'")
				.get()
		).toEqual({ status: 'present' });
		expect(
			sqlite.prepare("select count(*) as count from sub_requests where reason = 'absence'").get()
		).toEqual({ count: 0 });
	});

	it('ne garde pas une réclamation sans sa trace', () => {
		failAudit();

		let caught: unknown;
		try {
			claimSubstitute(author, game, 'claim');
		} catch (cause) {
			caught = cause;
		}
		expect(caught).toBeTruthy();
		expect(caught).not.toMatchObject({ key: 'subs.alreadyPlaying' });

		expect(
			sqlite.prepare("select status from sub_requests where id = 'claim'").get()
		).toEqual({ status: 'open' });
	});

	it('signale seulement le remplaçant déjà placé dans ce match', () => {
		claimSubstitute(author, game, 'claim');

		expect(() => claimSubstitute(author, game, 'own')).toThrowError(
			expect.objectContaining({ code: 'CONFLICT', key: 'subs.alreadyPlaying' })
		);
	});

	it('ne garde pas une demande manuelle sans sa trace', () => {
		failAudit();

		expect(() => createManualRequest(admin, game, 'defense')).toThrow();

		expect(
			sqlite.prepare("select count(*) as count from sub_requests").get()
		).toEqual({ count: 3 });
	});

	it('ne libère pas une place de remplaçant sans sa trace', () => {
		failAudit();

		expect(() => releaseSubstitute(regular, game, 'filled')).toThrow();

		expect(
			sqlite
				.prepare("select status, filled_by_player_id from sub_requests where id = 'filled'")
				.get()
		).toEqual({ status: 'filled', filled_by_player_id: 'regular' });
	});

	it('ne ferme pas une demande sans sa trace', () => {
		failAudit();

		expect(() => cancelOwnRequest(regular, game, 'own')).toThrow();

		expect(
			sqlite.prepare("select status from sub_requests where id = 'own'").get()
		).toEqual({ status: 'open' });
	});

	it('ne garde pas une note de saison sans sa trace', () => {
		failAudit();

		expect(() =>
			setRatings(admin, 'author', {
				passing: 4,
				speed: 3,
				agility: 3,
				backchecking: 3
			})
		).toThrow();

		expect(
			sqlite.prepare('select count(*) as count from player_ratings').get()
		).toEqual({ count: 0 });
	});

	it('ne garde pas une note de match sans sa trace', () => {
		failAudit();

		expect(() => saveGameAssessment(admin, 'past', 'author', { impact: 4 })).toThrow();

		expect(
			sqlite.prepare('select count(*) as count from game_player_ratings').get()
		).toEqual({ count: 0 });
	});
});
