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
const { setSubstituteFavorite } = await import('#lib/domain/subs/service.ts');
const { setPlayerRole } = await import('#lib/domain/players/service.ts');
const { provideIdentity } = await import('#lib/domain/auth/identity.ts');
import type { IdentityProvider } from '#lib/domain/auth/identity.ts';

const admin: Actor = {
	kind: 'user',
	active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

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
		'poll_votes',
		'poll_options',
		'polls',
		'chat_messages',
		'sub_profiles',
		'audit_log',
		'league_settings',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	for (const [id, role] of [
		['admin', 'admin'],
		['author', 'player']
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
			 values ('author', 'Auteur', 'Test', 'forward', 30, 1, 1, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into chat_messages (id, author_user_id, kind, body, created_at)
			 values ('message', 'author', 'text', 'Bonjour', 0)`
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
});
