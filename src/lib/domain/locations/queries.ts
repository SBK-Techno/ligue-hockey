import { asc, count, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { games } from '#lib/domain/games/schema.ts';
import { locations, type LocationRow } from './schema.ts';

export type LocationMetricsRow = {
	locationId: string;
	gameCount: number;
	completedCount: number;
	nextGameDate: string | null;
	lastGameDate: string | null;
};

export function listLocationRows(): LocationRow[] {
	return db.select().from(locations).orderBy(asc(locations.name)).all();
}

export function findLocation(id: string): LocationRow | undefined {
	return db.select().from(locations).where(eq(locations.id, id)).get();
}

export function findLocationByName(name: string): LocationRow | undefined {
	return db.select().from(locations).where(eq(locations.name, name)).get();
}

export function insertLocation(row: typeof locations.$inferInsert): void {
	db.insert(locations).values(row).run();
}

export function updateLocation(
	id: string,
	patch: Partial<Pick<LocationRow, 'name' | 'address' | 'mapUrl' | 'notes'>>,
	updatedAt: number
): void {
	db.update(locations)
		.set({ ...patch, updatedAt })
		.where(eq(locations.id, id))
		.run();
}

export function deleteLocationIfUnused(id: string): boolean {
	return db.transaction((tx) => {
		const used = tx
			.select({ count: count(games.id) })
			.from(games)
			.where(eq(games.locationId, id))
			.get();

		if ((used?.count ?? 0) > 0) return false;
		tx.delete(locations).where(eq(locations.id, id)).run();
		return true;
	});
}

export function listLocationMetrics(today: string): LocationMetricsRow[] {
	return db
		.select({
			locationId: locations.id,
			gameCount: count(games.id),
			completedCount: sql<number>`count(case when ${games.status} = 'completed' then 1 end)`,
			nextGameDate: sql<
				string | null
			>`min(case when ${games.status} = 'scheduled' and ${games.gameDate} >= ${today} then ${games.gameDate} end)`,
			lastGameDate: sql<
				string | null
			>`max(case when ${games.status} = 'completed' or ${games.gameDate} < ${today} then ${games.gameDate} end)`
		})
		.from(locations)
		.leftJoin(games, eq(games.locationId, locations.id))
		.groupBy(locations.id)
		.all();
}
