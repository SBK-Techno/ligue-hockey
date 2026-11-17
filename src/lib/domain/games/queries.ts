import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, type DbExecutor } from '#lib/server/db/index.ts';
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
	/**
	 * Construit l'audit de purge à partir des joueurs dont les notes ont
	 * réellement été retirées. Le diff est calculé dans la transaction, entre
	 * l'ancien alignement et le nouveau, donc le banc n'est jamais purgé.
	 */
	ratingsAudit?: (playerIds: readonly string[]) => AuditEntry;
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

		// Le seul propriétaire du diff de purge : l'ancien ensemble habillé
		// moins le nouveau. Un joueur au banc n'a jamais été habillé et garde
		// donc ses notes; un joueur sorti de la glace les perd.
		const previousDressed = new Set(
			tx
				.select({ playerId: gameSlots.assignedPlayerId })
				.from(gameSlots)
				.where(eq(gameSlots.gameId, gameId))
				.all()
				.map((row) => row.playerId)
				.filter((playerId): playerId is string => playerId !== null)
		);
		const nextDressed = new Set(assignments.map((assignment) => assignment.playerId));
		const removedRatedPlayerIds = [...previousDressed].filter(
			(playerId) => !nextDressed.has(playerId)
		);

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

		deleteGameRatingsForPlayers(gameId, removedRatedPlayerIds, tx);
		if (removedRatedPlayerIds.length > 0 && options.ratingsAudit) {
			insertAudit(options.ratingsAudit(removedRatedPlayerIds), tx);
		}
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
	audit: AuditEntry,
	finalize?: (executor: DbExecutor) => void
): boolean {
	return db.transaction((tx) => {
		const result = tx
			.update(games)
			.set({ status: 'completed', completedAt: at, updatedAt: at })
			.where(and(eq(games.id, gameId), eq(games.status, 'scheduled')))
			.run();
		if (result.changes !== 1) return false;
		insertAudit(audit, tx);
		finalize?.(tx);
		return true;
	});
}

export function updateGame(
	gameId: string,
	patch: Partial<
		Pick<NewGame, 'gameDate' | 'startTime' | 'locationId' | 'location' | 'notes' | 'status'>
	>,
	updatedAt: number,
	expectedUpdatedAt: number
): boolean {
	const result = db
		.update(games)
		.set({ ...patch, updatedAt })
		.where(
			and(
				eq(games.id, gameId),
				eq(games.status, 'scheduled'),
				eq(games.updatedAt, expectedUpdatedAt)
			)
		)
		.run();
	return result.changes === 1;
}

/**
 * Annule seulement un match encore programmé et jamais terminé. Le statut et
 * l'estampille de fin sont dans la condition : un finalize concurrent gagne et
 * l'annulation échoue au lieu d'écraser l'historique.
 */
export function cancelGame(gameId: string, updatedAt: number): boolean {
	const result = db
		.update(games)
		.set({ status: 'cancelled', updatedAt })
		.where(
			and(
				eq(games.id, gameId),
				eq(games.status, 'scheduled'),
				isNull(games.completedAt)
			)
		)
		.run();
	return result.changes === 1;
}

export function listAvailability(gameId: string) {
	return db
		.select()
		.from(gameAvailability)
		.where(eq(gameAvailability.gameId, gameId))
		.all();
}

/** La réponse d'un joueur pour plusieurs matchs, en une seule lecture. */
export function listAvailabilityForPlayer(gameIds: readonly string[], playerId: string) {
	if (gameIds.length === 0) return [];
	return db
		.select()
		.from(gameAvailability)
		.where(
			and(
				inArray(gameAvailability.gameId, [...gameIds]),
				eq(gameAvailability.playerId, playerId)
			)
		)
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
