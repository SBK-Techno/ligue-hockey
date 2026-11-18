import { and, asc, count, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db, type DbExecutor } from '#lib/server/db/index.ts';
import type { AuditEntry } from '#lib/domain/audit/queries.ts';
import { insertAudit } from '#lib/domain/audit/queries.ts';
import { slotKey } from '#config/slot.ts';
import { isPublished } from './published.ts';
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

export type GameListRow = {
	id: string;
	gameDate: string;
	startTime: string;
	locationId: string;
	location: string;
	status: 'scheduled' | 'cancelled' | 'completed';
	generated: boolean;
	openSlots: number;
};

/**
 * La projection de liste : l'état de génération et le nombre de places vides
 * de plusieurs matchs, en deux lectures bornées. Aucun appelant ne rejoue une
 * fiche complète par ligne.
 */
export function listGameListRows(gameIds: readonly string[]): GameListRow[] {
	if (gameIds.length === 0) return [];
	const rows = db
		.select({
			id: games.id,
			gameDate: games.gameDate,
			startTime: games.startTime,
			locationId: games.locationId,
			location: games.location,
			status: games.status,
			generatedAt: games.generatedAt,
			generationJson: games.generationJson
		})
		.from(games)
		.where(inArray(games.id, [...gameIds]))
		.all();
	const counts = db
		.select({ gameId: gameSlots.gameId, open: count() })
		.from(gameSlots)
		.where(
			and(
				inArray(gameSlots.gameId, [...gameIds]),
				isNull(gameSlots.assignedPlayerId)
			)
		)
		.groupBy(gameSlots.gameId)
		.all();
	const open = new Map(counts.map((row) => [row.gameId, row.open]));

	return rows.map((row) => ({
		id: row.id,
		gameDate: row.gameDate,
		startTime: row.startTime,
		locationId: row.locationId,
		location: row.location,
		status: row.status,
		generated: isPublished(row),
		openSlots: open.get(row.id) ?? 0
	}));
}

/**
 * Le nombre de joueurs habillés par équipe pour plusieurs matchs. Une seule
 * lecture groupée sert l'historique de la section Équipes; chaque match garde
 * donc les compteurs de l'alignement qui a réellement été publié.
 */
export function listTeamSlotCounts(
	gameIds: readonly string[]
): { gameId: string; team: 'white' | 'black'; count: number }[] {
	if (gameIds.length === 0) return [];
	return db
		.select({ gameId: gameSlots.gameId, team: gameSlots.team, count: count() })
		.from(gameSlots)
		.where(
			and(
				inArray(gameSlots.gameId, [...gameIds]),
				isNotNull(gameSlots.assignedPlayerId)
			)
		)
		.groupBy(gameSlots.gameId, gameSlots.team)
		.all();
}

/**
 * Les instantanés publiés de plusieurs matchs, pour compter le banc habillé
 * par équipe en plus des places sur la glace. La lecture reste groupée; le
 * décodage du banc appartient au service, pas au SQL.
 */
export function listGenerationSnapshots(
	gameIds: readonly string[]
): { gameId: string; generationJson: string | null }[] {
	if (gameIds.length === 0) return [];
	return db
		.select({ gameId: games.id, generationJson: games.generationJson })
		.from(games)
		.where(inArray(games.id, [...gameIds]))
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

/**
 * Les joueurs qui habillent le banc d'une équipe dans un instantané. Le banc
 * habillé fait partie de l'effectif; le banc global (sans équipe) n'en fait
 * pas partie. Un instantané illisible ne donne aucun banc habillé.
 */
function rosteredBenchIds(generationJson: string | null | undefined): string[] {
	if (!generationJson) return [];
	try {
		const snapshot = JSON.parse(generationJson) as {
			bench?: { playerId?: unknown; team?: unknown }[];
		};
		return (snapshot.bench ?? [])
			.filter((entry) => entry.team && typeof entry.playerId === 'string')
			.map((entry) => entry.playerId as string);
	} catch {
		return [];
	}
}

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

		// L'ancien instantané est lu avant le remplacement : son banc habillé
		// fait partie de l'ancien effectif pour le diff de purge.
		const previousSnapshot = tx
			.select({ generationJson: games.generationJson })
			.from(games)
			.where(eq(games.id, gameId))
			.get();

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

		// Le seul propriétaire du diff de purge : l'ancien effectif habillé
		// (glace et banc par équipe) moins le nouveau. Un joueur qui reste
		// habillé, sur la glace ou au banc de son équipe, garde ses notes;
		// seul un joueur qui quitte l'effectif les perd.
		const previousDressed = new Set([
			...tx
				.select({ playerId: gameSlots.assignedPlayerId })
				.from(gameSlots)
				.where(eq(gameSlots.gameId, gameId))
				.all()
				.map((row) => row.playerId)
				.filter((playerId): playerId is string => playerId !== null),
			...rosteredBenchIds(previousSnapshot?.generationJson)
		]);
		const nextDressed = new Set([
			...assignments.map((assignment) => assignment.playerId),
			...rosteredBenchIds(generationJson)
		]);
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
					`Unknown alignment slot: ${slotKey(assignment)}`
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
 * Retire un joueur du bassin publié d'un match à venir : sa place redevient
 * vide et il quitte le banc de l'instantané. La place, le banc, la purge de
 * ses notes de match et l'audit tiennent dans une seule transaction.
 */
export function releasePlayerSlot(
	gameId: string,
	playerId: string,
	releasedAt: number,
	audit: AuditEntry,
	executor: DbExecutor = db
): boolean {
	if (executor === db) {
		return db.transaction((tx) =>
			releasePlayerSlotIn(tx, gameId, playerId, releasedAt, audit)
		);
	}
	return releasePlayerSlotIn(executor, gameId, playerId, releasedAt, audit);
}

function releasePlayerSlotIn(
	executor: DbExecutor,
	gameId: string,
	playerId: string,
	releasedAt: number,
	audit: AuditEntry
): boolean {
	const row = executor.select().from(games).where(eq(games.id, gameId)).get();
	if (!row) return false;
	const slot = executor
		.select({ id: gameSlots.id })
		.from(gameSlots)
		.where(
			and(
				eq(gameSlots.gameId, gameId),
				eq(gameSlots.assignedPlayerId, playerId)
			)
		)
		.get();

	let generationJson = row.generationJson;
	let onBench = false;
	if (generationJson) {
		try {
			const snapshot = JSON.parse(generationJson) as {
				bench?: { playerId?: unknown }[];
			};
			onBench =
				Array.isArray(snapshot.bench) &&
				snapshot.bench.some((entry) => entry.playerId === playerId);
			if (onBench) {
				generationJson = JSON.stringify({
					...snapshot,
					bench: snapshot.bench!.filter((entry) => entry.playerId !== playerId)
				});
			}
		} catch {
			generationJson = row.generationJson;
		}
	}

	if (!slot && !onBench) return false;

	if (slot) {
		executor
			.update(gameSlots)
			.set({ assignedPlayerId: null, assignmentKind: null, updatedAt: releasedAt })
			.where(eq(gameSlots.id, slot.id))
			.run();
		deleteGameRatingsForPlayers(gameId, [playerId], executor);
	}
	if (generationJson !== row.generationJson) {
		executor
			.update(games)
			.set({ generationJson, updatedAt: releasedAt })
			.where(eq(games.id, gameId))
			.run();
	}
	insertAudit(audit, executor);
	return true;
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
	expectedUpdatedAt: number,
	audit?: AuditEntry
): boolean {
	return db.transaction((tx) => {
		const result = tx
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
		if (result.changes !== 1) return false;
		if (audit) insertAudit(audit, tx);
		return true;
	});
}

/**
 * Annule seulement un match encore programmé et jamais terminé. Le statut, la
 * trace d'audit et la fermeture des demandes vivent dans la même transaction :
 * une erreur de fermeture laisse le match intact.
 */
export function cancelGame(
	gameId: string,
	updatedAt: number,
	audit: AuditEntry,
	close?: (executor: DbExecutor) => void
): boolean {
	return db.transaction((tx) => {
		const result = tx
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
		if (result.changes !== 1) return false;
		insertAudit(audit, tx);
		close?.(tx);
		return true;
	});
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
	updatedAt: number,
	executor: DbExecutor = db
): void {
	executor
		.insert(gameAvailability)
		.values({ gameId, playerId, status, updatedAt })
		.onConflictDoUpdate({
			target: [gameAvailability.gameId, gameAvailability.playerId],
			set: { status, updatedAt }
		})
		.run();
}
