import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { players, type NewPlayerRow, type PlayerRow } from './schema.ts';

export type PlayerWithEmail = PlayerRow & {
	email: string;
	role: string | null;
};

export function findPlayer(playerId: string): PlayerRow | undefined {
	return db.select().from(players).where(eq(players.userId, playerId)).get();
}

export function findPlayerWithEmail(
	playerId: string
): PlayerWithEmail | undefined {
	return db
		.select({
			userId: players.userId,
			firstName: players.firstName,
			lastName: players.lastName,
			position: players.position,
			age: players.age,
			isSubstitute: players.isSubstitute,
			active: players.active,
			createdAt: players.createdAt,
			updatedAt: players.updatedAt,
			email: user.email,
			role: user.role
		})
		.from(players)
		.innerJoin(user, eq(user.id, players.userId))
		.where(eq(players.userId, playerId))
		.get();
}

export function findPlayersByIds(playerIds: readonly string[]): PlayerRow[] {
	if (playerIds.length === 0) return [];
	return db
		.select()
		.from(players)
		.where(inArray(players.userId, [...playerIds]))
		.all();
}

export function listActivePlayers(): PlayerRow[] {
	return db
		.select()
		.from(players)
		.where(eq(players.active, true))
		.orderBy(asc(players.lastName), asc(players.firstName))
		.all();
}

export function listAllPlayersWithEmail(): PlayerWithEmail[] {
	return db
		.select({
			userId: players.userId,
			firstName: players.firstName,
			lastName: players.lastName,
			position: players.position,
			age: players.age,
			isSubstitute: players.isSubstitute,
			active: players.active,
			createdAt: players.createdAt,
			updatedAt: players.updatedAt,
			email: user.email,
			role: user.role
		})
		.from(players)
		.innerJoin(user, eq(user.id, players.userId))
		.orderBy(asc(players.active), asc(players.lastName), asc(players.firstName))
		.all();
}

export function insertPlayer(row: NewPlayerRow): void {
	db.insert(players).values(row).run();
}

export type PlayerPatch = Partial<
	Pick<
		PlayerRow,
		'firstName' | 'lastName' | 'position' | 'age' | 'isSubstitute' | 'active'
	>
>;

export function updatePlayer(playerId: string, patch: PlayerPatch): void {
	if (Object.keys(patch).length === 0) return;
	db.update(players)
		.set({ ...patch, updatedAt: clock.nowMs() })
		.where(eq(players.userId, playerId))
		.run();
}
