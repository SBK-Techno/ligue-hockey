import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import type { AuditEntry } from '#lib/domain/audit/queries.ts';
import { insertAudit } from '#lib/domain/audit/queries.ts';
import { players } from '#lib/domain/players/schema.ts';
import { deleteGameRatingsForPlayers } from '#lib/domain/ratings/queries.ts';
import { gameAvailability, gameSlots, games } from './schema.ts';

export type NewGame = typeof games.$inferInsert;
export type NewGameSlot = typeof gameSlots.$inferInsert;

export function insertGameWithSlots(
	game: NewGame,
	slots: readonly NewGameSlot[]
): void {
	db.transaction((tx) => {
		tx.insert(games).values(game).run();
		for (const slot of slots) {
			tx.insert(gameSlots).values(slot).run();
		}
	});
}

export function findGame(gameId: string) {
	return db.select().from(games).where(eq(games.id, gameId)).get();
}

export function listGames() {
	return db
		.select()
		.from(games)
		.orderBy(asc(games.gameDate), asc(games.startTime))
		.all();
}

export function listRecentGames(limit: number) {
	return db
		.select()
		.from(games)
		.orderBy(desc(games.gameDate), desc(games.startTime))
		.limit(limit)
		.all();
}

export function listSlots(gameId: string) {
	return db
		.select()
		.from(gameSlots)
		.where(eq(gameSlots.gameId, gameId))
		.orderBy(asc(gameSlots.team), asc(gameSlots.position), asc(gameSlots.slotIndex))
		.all();
}

export function listSlotAssignments(gameId: string) {
	return db
		.select({
			team: gameSlots.team,
			position: gameSlots.position,
			slotIndex: gameSlots.slotIndex,
			playerId: gameSlots.assignedPlayerId,
			assignmentKind: gameSlots.assignmentKind,
			firstName: players.firstName,
			lastName: players.lastName
		})
		.from(gameSlots)
		.leftJoin(players, eq(players.userId, gameSlots.assignedPlayerId))
		.where(eq(gameSlots.gameId, gameId))
		.orderBy(asc(gameSlots.team), asc(gameSlots.position), asc(gameSlots.slotIndex))
		.all();
}

export type SlotAssignment = {
	team: (typeof gameSlots.$inferSelect)['team'];
	position: (typeof gameSlots.$inferSelect)['position'];
	slotIndex: number;
	playerId: string;
	kind: (typeof gameSlots.$inferSelect)['assignmentKind'];
};

export type SaveAssignmentsOptions = {
	/** Audits écrits dans la même transaction que les places. */
	audits?: readonly AuditEntry[];
	/** Joueurs sortis de l'alignement dont les notes de match sont purgées. */
	removedRatedPlayerIds?: readonly string[];
	/**
	 * Jeton de concurrence : la génération enregistrée doit encore être celle
	 * que l'appelant a lue. Absent, aucune condition n'est posée; null exige
	 * l'absence de toute génération.
	 */
	expectedGeneratedAt?: number | null;
	/** Date de l'alignement manuel; null efface le drapeau. Absent, inchangé. */
	manualAt?: number | null;
};

export function saveAssignments(
	gameId: string,
	assignments: readonly SlotAssignment[],
	generatedAt: number,
	generationJson: string,
	updatedAt: number,
	options: SaveAssignmentsOptions = {}
): boolean {
	const written = new Set(assignments.map((assignment) => assignment.playerId));
	for (const playerId of options.removedRatedPlayerIds ?? []) {
		if (written.has(playerId)) {
			throw new Error(`Cannot purge ratings for a dressed player: ${playerId}`);
		}
	}
	const hasCondition = 'expectedGeneratedAt' in options;

	return db.transaction((tx) => {
		const generation = {
			generatedAt,
			generationJson,
			updatedAt,
			...(options.manualAt !== undefined
				? { lineupManualAt: options.manualAt }
				: {})
		};

		// Le jeton se vérifie avant toute écriture de place : une lecture
		// périmée ne doit jamais laisser un alignement à moitié remplacé.
		if (hasCondition) {
			const expected = options.expectedGeneratedAt ?? null;
			const claimed = tx
				.update(games)
				.set(generation)
				.where(
					and(
						eq(games.id, gameId),
						expected === null
							? isNull(games.generatedAt)
							: eq(games.generatedAt, expected)
					)
				)
				.run();
			if (claimed.changes !== 1) return false;
		}

		tx.update(gameSlots)
			.set({ assignedPlayerId: null, assignmentKind: null, updatedAt })
			.where(eq(gameSlots.gameId, gameId))
			.run();

		for (const assignment of assignments) {
			const writtenSlot = tx
				.update(gameSlots)
				.set({
					assignedPlayerId: assignment.playerId,
					assignmentKind: assignment.kind,
					updatedAt
				})
				.where(
					and(
						eq(gameSlots.gameId, gameId),
						eq(gameSlots.team, assignment.team),
						eq(gameSlots.position, assignment.position),
						eq(gameSlots.slotIndex, assignment.slotIndex)
					)
				)
				.run();
			if (writtenSlot.changes !== 1) {
				throw new Error(
					`Unknown alignment slot: ${assignment.team}:${assignment.position}:${assignment.slotIndex}`
				);
			}
		}

		if (!hasCondition) {
			tx.update(games).set(generation).where(eq(games.id, gameId)).run();
		}

		deleteGameRatingsForPlayers(gameId, options.removedRatedPlayerIds ?? [], tx);
		for (const audit of options.audits ?? []) {
			insertAudit(audit, tx);
		}

		return true;
	});
}

/**
 * Termine un match encore programmé. La condition sur le statut rend l'action
 * atomique : deux finalisations concurrentes ne peuvent pas réussir toutes les
 * deux, et l'audit entre dans la même transaction.
 */
export function completeGame(
	gameId: string,
	at: number,
	audit: AuditEntry
): boolean {
	return db.transaction((tx) => {
		const result = tx
			.update(games)
			.set({ status: 'completed', completedAt: at, updatedAt: at })
			.where(and(eq(games.id, gameId), eq(games.status, 'scheduled')))
			.run();
		if (result.changes !== 1) return false;
		insertAudit(audit, tx);
		return true;
	});
}

export function updateGame(
	gameId: string,
	patch: Partial<
		Pick<NewGame, 'gameDate' | 'startTime' | 'locationId' | 'location' | 'notes' | 'status'>
	>,
	updatedAt: number
): void {
	db.update(games)
		.set({ ...patch, updatedAt })
		.where(eq(games.id, gameId))
		.run();
}

export function cancelGame(gameId: string, updatedAt: number): void {
	db.update(games)
		.set({ status: 'cancelled', updatedAt })
		.where(eq(games.id, gameId))
		.run();
}

export function listAvailability(gameId: string) {
	return db
		.select()
		.from(gameAvailability)
		.where(eq(gameAvailability.gameId, gameId))
		.all();
}

export function findAvailability(gameId: string, playerId: string) {
	return db
		.select()
		.from(gameAvailability)
		.where(
			and(
				eq(gameAvailability.gameId, gameId),
				eq(gameAvailability.playerId, playerId)
			)
		)
		.get();
}

export function upsertAvailability(
	gameId: string,
	playerId: string,
	status: 'present' | 'absent',
	updatedAt: number
): void {
	db.insert(gameAvailability)
		.values({ gameId, playerId, status, updatedAt })
		.onConflictDoUpdate({
			target: [gameAvailability.gameId, gameAvailability.playerId],
			set: { status, updatedAt }
		})
		.run();
}
