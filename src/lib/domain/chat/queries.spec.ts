import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La pagination descendante et la synchronisation ascendante doivent
 * partager exactement le même ordre (date, identifiant) : un message écrit
 * dans la même milliseconde ne peut ni manquer ni apparaître deux fois.
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
const { listDeletedMessageIds, listMessages, listMessagesAfter, listPollMessageRows } =
	await import('./queries.ts');

function insertMessage(input: {
	id: string;
	createdAt: number;
	kind?: 'text' | 'poll';
	deletedAt?: number;
}) {
	const kind = input.kind ?? 'text';
	sqlite
		.prepare(
			`insert into chat_messages (id, author_user_id, kind, body, created_at, deleted_at, deleted_by)
			 values (?, 'player', ?, ?, ?, ?, ?)`
		)
		.run(
			input.id,
			kind,
			kind === 'text' ? `Message ${input.id}` : null,
			input.createdAt,
			input.deletedAt ?? null,
			input.deletedAt === undefined ? null : 'player'
		);
}

beforeEach(() => {
	for (const table of [
		'poll_votes',
		'poll_options',
		'polls',
		'chat_messages',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('player', 'Samuel Tremblay', 'samuel@example.test', 1, 0, 0, 'player')`
		)
		.run();
});

describe('pagination de la discussion', () => {
	function seedTiedTimeline() {
		insertMessage({ id: 'msg_a', createdAt: 1_000 });
		insertMessage({ id: 'msg_b', createdAt: 1_000 });
		insertMessage({ id: 'msg_c', createdAt: 1_000 });
		insertMessage({ id: 'msg_d', createdAt: 2_000 });
		insertMessage({ id: 'msg_e', createdAt: 2_000 });
		insertMessage({ id: 'msg_f', createdAt: 3_000 });
	}

	it('partitionne le fil entre la page précédente et la synchronisation', () => {
		seedTiedTimeline();

		const descending: string[] = [];
		let before: { createdAt: number; id: string } | null = null;
		for (;;) {
			const page = listMessages(2, before);
			descending.push(...page.map((row) => row.id));
			if (page.length < 2) break;
			const last = page.at(-1)!;
			before = { createdAt: last.createdAt, id: last.id };
		}

		const ascending: string[] = [];
		let after: { createdAt: number; id: string } = { createdAt: 0, id: '' };
		for (;;) {
			const page = listMessagesAfter(2, after);
			ascending.push(...page.map((row) => row.id));
			if (page.length < 2) break;
			const last = page.at(-1)!;
			after = { createdAt: last.createdAt, id: last.id };
		}

		expect(descending).toEqual(['msg_f', 'msg_e', 'msg_d', 'msg_c', 'msg_b', 'msg_a']);
		expect(ascending).toEqual([...descending].reverse());
		expect(new Set(ascending).size).toBe(ascending.length);
	});

	it('départage exactement les messages de la même milliseconde', () => {
		seedTiedTimeline();

		expect(listMessagesAfter(1, { createdAt: 1_000, id: 'msg_a' }).map((row) => row.id)).toEqual([
			'msg_b'
		]);
		expect(listMessagesAfter(1, { createdAt: 1_000, id: 'msg_b' }).map((row) => row.id)).toEqual([
			'msg_c'
		]);
		expect(
			listMessages(2, { createdAt: 1_000, id: 'msg_c' }).map((row) => row.id)
		).toEqual(['msg_b', 'msg_a']);
	});
});

describe('identifiants supprimés', () => {
	it('respecte l’instant de référence, l’ordre et la limite', () => {
		insertMessage({ id: 'msg_b', createdAt: 1_000, deletedAt: 1_200 });
		insertMessage({ id: 'msg_a', createdAt: 1_000, deletedAt: 1_200 });
		insertMessage({ id: 'msg_c', createdAt: 1_000, deletedAt: 1_500 });
		insertMessage({ id: 'msg_d', createdAt: 1_000 });

		expect(listDeletedMessageIds(1_100, 10)).toEqual(['msg_a', 'msg_b', 'msg_c']);
		expect(listDeletedMessageIds(1_200, 10)).toEqual(['msg_c']);
		expect(listDeletedMessageIds(1_100, 2)).toEqual(['msg_a', 'msg_b']);
		expect(listDeletedMessageIds(1_500, 10)).toEqual([]);
	});
});

describe('sondages de la colonne', () => {
	it('inclut les sondages supprimés, du plus récent au plus ancien', () => {
		insertMessage({ id: 'msg_text', createdAt: 4_000 });
		insertMessage({ id: 'poll_old', createdAt: 1_000, kind: 'poll' });
		insertMessage({ id: 'poll_mid', createdAt: 2_000, kind: 'poll' });
		insertMessage({
			id: 'poll_new',
			createdAt: 3_000,
			kind: 'poll',
			deletedAt: 3_100
		});

		expect(listPollMessageRows(10).map((row) => row.id)).toEqual([
			'poll_new',
			'poll_mid',
			'poll_old'
		]);
		expect(listPollMessageRows(2).map((row) => row.id)).toEqual(['poll_new', 'poll_mid']);
		expect(listPollMessageRows(10)[0].deletedAt).toBe(3_100);
	});
});
