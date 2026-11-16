import { sqlite } from '#lib/server/db/index.ts';

export type DatabaseHealth = {
	migrations: 'applied' | 'missing';
};

export function databaseHealth(): DatabaseHealth {
	sqlite.prepare('select 1 as ok').get();
	const row = sqlite
		.prepare(
			"select count(*) as count from sqlite_master where type = 'table' and name = '__drizzle_migrations'"
		)
		.get() as { count: number };
	return { migrations: row.count > 0 ? 'applied' : 'missing' };
}
