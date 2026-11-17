import { eq } from 'drizzle-orm';
import { db, type DbExecutor } from '#lib/server/db/index.ts';
import { leagueSettings } from './schema.ts';

export type SettingEntry = {
	key: string;
	valueJson: string;
	updatedAt: number;
	updatedBy: string | null;
};

export function listSettings(): (typeof leagueSettings.$inferSelect)[] {
	return db.select().from(leagueSettings).all();
}

export function readSetting(key: string) {
	return db
		.select()
		.from(leagueSettings)
		.where(eq(leagueSettings.key, key))
		.get();
}

export function saveSettings(
	entries: readonly SettingEntry[],
	executor: DbExecutor = db
): void {
	if (entries.length === 0) return;

	if (executor === db) {
		db.transaction((tx) => saveSettings(entries, tx));
		return;
	}
	for (const entry of entries) {
		executor
			.insert(leagueSettings)
			.values(entry)
			.onConflictDoUpdate({
				target: leagueSettings.key,
				set: {
					valueJson: entry.valueJson,
					updatedAt: entry.updatedAt,
					updatedBy: entry.updatedBy
				}
			})
			.run();
	}
}
