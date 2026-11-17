import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

const audit = vi.hoisted(() => ({ fail: false }));

vi.mock('#lib/domain/audit/service.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/domain/audit/service.ts')>();
	return {
		...actual,
		recordAudit: (...args: Parameters<typeof actual.recordAudit>) => {
			if (audit.fail) throw new Error('audit down');
			actual.recordAudit(...args);
		}
	};
});

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
const { invalidateSettingsCache, updateSettings } = await import('./service.ts');

const admin: Actor = {
	kind: 'user',
	active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

beforeEach(() => {
	audit.fail = false;
	sqlite.prepare('delete from league_settings').run();
	sqlite.prepare('delete from user').run();
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('admin', 'Admin', 'admin@example.test', 1, 0, 0, 'admin')`
		)
		.run();
	invalidateSettingsCache();
});

describe('atomicité des réglages', () => {
	it('n’écrit aucun réglage quand la trace d’audit échoue', () => {
		audit.fail = true;

		expect(() =>
			updateSettings(admin, { 'league.seasonLabel': 'Saison test' })
		).toThrow('audit down');

		const row = sqlite
			.prepare(`select count(*) as count from league_settings`)
			.get() as { count: number };
		expect(row.count).toBe(0);
	});
});
