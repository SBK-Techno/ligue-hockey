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
const { deleteChatMessage } = await import('./service.ts');

const moderator: Actor = {
	kind: 'user',
	active: true,
	userId: 'moderator',
	name: 'Modérateur',
	role: 'admin'
};

beforeEach(() => {
	for (const table of ['chat_messages', 'audit_log', 'players', 'user']) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	for (const [id, role] of [
		['moderator', 'admin'],
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
			 (user_id, first_name, last_name, position, age, active, created_at, updated_at)
			 values ('author', 'Auteur', 'Test', 'forward', 30, 1, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into chat_messages (id, author_user_id, kind, body, created_at)
			 values ('message', 'author', 'text', 'À supprimer', 0)`
		)
		.run();
});

describe('suppression modérée', () => {
	it('enregistre l’acteur, l’auteur et le message dans la même transaction', () => {
		deleteChatMessage(moderator, 'message');

		const row = sqlite
			.prepare(
				`select actor_user_id, entity_id, metadata_json
				 from audit_log where action = 'chat.message_deleted'`
			)
			.get() as {
			actor_user_id: string;
			entity_id: string;
			metadata_json: string;
		};
		expect(row).toEqual({
			actor_user_id: 'moderator',
			entity_id: 'message',
			metadata_json: JSON.stringify({ authorUserId: 'author' })
		});
		expect(
			sqlite.prepare("select deleted_by from chat_messages where id = 'message'").get()
		).toEqual({ deleted_by: 'moderator' });
	});
});
