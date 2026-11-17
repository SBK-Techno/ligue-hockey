import { beforeEach, describe, expect, it, vi } from 'vitest';

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
const { invalidateSettingsCache, getSettings } = await import('#lib/domain/settings/service.ts');
const { listChatSummary } = await import('./service.ts');

const actor = {
	kind: 'user' as const,
	active: true,
	userId: 'me',
	role: 'player' as const,
	name: 'Moi'
};

function seed(): void {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('me', 'Moi', 'me@example.test', 1, 0, 0, 'player')`
		)
		.run();
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, avatar_id, is_substitute, active, created_at, updated_at)
			 values ('me', 'Moi', 'Test', 'forward', 30, 'tuque-rouge', 0, 1, 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into chat_messages (id, author_user_id, kind, body, created_at)
			 values ('msg_text', 'me', 'text', 'Dernier message', 100)`
		)
		.run();
	sqlite
		.prepare(
			`insert into chat_messages (id, author_user_id, kind, body, created_at)
			 values ('msg_poll', 'me', 'poll', null, 90)`
		)
		.run();
	sqlite
		.prepare(
			`insert into polls (message_id, question, closes_at, created_at)
			 values ('msg_poll', 'On joue ?', null, 90)`
		)
		.run();
	sqlite
		.prepare(
			`insert into poll_options (id, message_id, label, option_index)
			 values ('opt_1', 'msg_poll', 'Oui', 0)`
		)
		.run();
}

beforeEach(() => {
	sqlite.prepare('delete from poll_votes').run();
	sqlite.prepare('delete from poll_options').run();
	sqlite.prepare('delete from polls').run();
	sqlite.prepare('delete from chat_messages').run();
	sqlite.prepare('delete from players').run();
	sqlite.prepare('delete from user').run();
	seed();
	invalidateSettingsCache();
	getSettings();
});

describe('résumé de discussion de l’accueil', () => {
	it('borne le nombre de requêtes SQL du résumé', () => {
		const original = sqlite.prepare.bind(sqlite);
		let statements = 0;
		(sqlite as unknown as { prepare: typeof original }).prepare = ((sql: string) => {
			statements += 1;
			return original(sql);
		}) as typeof original;

		try {
			const summary = listChatSummary(actor);
			expect(summary.latestMessage?.id).toBe('msg_text');
			expect(summary.openPoll?.messageId).toBe('msg_poll');
			// message le plus récent, sondages ouverts, sondages, options, votes
			expect(statements).toBe(5);
		} finally {
			(sqlite as unknown as { prepare: typeof original }).prepare = original;
		}
	});
});
