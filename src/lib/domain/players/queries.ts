import { and, asc, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import {
	identityAllowedForPosition,
	isIdentityId,
	type IdentityId
} from '#config/identities.ts';
import type { Position } from '#config/positions.ts';
import { ADMIN_ROLE } from '#config/roles.ts';
import { positionRatingKeysToClear } from '#config/rating-attributes.ts';
import { db, type DbExecutor } from '#lib/server/db/index.ts';
import { account, session, user } from '#lib/server/db/auth.schema.ts';
import { gameAvailability, gameSlots, games } from '#lib/domain/games/schema.ts';
import { subProfiles, subRequests } from '#lib/domain/subs/schema.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { playerRatings, type PlayerRatingRow } from '#lib/domain/ratings/schema.ts';
import { firstFreeAvatarId } from './identity.ts';
import { players, type NewPlayerRow, type PlayerRow } from './schema.ts';

export type PlayerWithEmail = PlayerRow & {
	email: string;
	role: string | null;
};

export function findPlayer(playerId: string): PlayerRow | undefined {
	return db.select().from(players).where(eq(players.userId, playerId)).get();
}

export function findPlayerWithEmail(playerId: string): PlayerWithEmail | undefined {
	return db
		.select({
			userId: players.userId,
			firstName: players.firstName,
			lastName: players.lastName,
			position: players.position,
			age: players.age,
			jerseyNumber: players.jerseyNumber,
			avatarId: players.avatarId,
			isSubstitute: players.isSubstitute,
			active: players.active,
			deletedAt: players.deletedAt,
			createdAt: players.createdAt,
			updatedAt: players.updatedAt,
			email: user.email,
			role: user.role
		})
		.from(players)
		.innerJoin(user, eq(user.id, players.userId))
		.where(and(eq(players.userId, playerId), isNull(players.deletedAt)))
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

export type PlayerAvatarAssignment = {
	userId: string;
	avatarId: string | null;
};

/** Chaque ligne visible qui porte une identité, active ou non. */
export function listAvatarAssignments(): PlayerAvatarAssignment[] {
	return db
		.select({ userId: players.userId, avatarId: players.avatarId })
		.from(players)
		.where(or(eq(players.active, true), isNotNull(players.avatarId)))
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
			jerseyNumber: players.jerseyNumber,
			avatarId: players.avatarId,
			isSubstitute: players.isSubstitute,
			active: players.active,
			deletedAt: players.deletedAt,
			createdAt: players.createdAt,
			updatedAt: players.updatedAt,
			email: user.email,
			role: user.role
		})
		.from(players)
		.innerJoin(user, eq(user.id, players.userId))
		.where(isNull(players.deletedAt))
		.orderBy(asc(players.active), asc(players.lastName), asc(players.firstName))
		.all();
}

export type InsertPlayerResult =
	| { status: 'inserted'; avatarId: IdentityId }
	| { status: 'no-identity' }
	| { status: 'avatar-taken' }
	| { status: 'jersey-taken' };

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ReadExecutor = Transaction | typeof db;

function takenAvatarIds(executor: ReadExecutor): string[] {
	return executor
		.select({ avatarId: players.avatarId })
		.from(players)
		.where(isNotNull(players.avatarId))
		.all()
		.map((row) => row.avatarId)
		.filter((avatarId): avatarId is string => avatarId !== null);
}

function isUniqueConstraint(error: unknown): boolean {
	const code = (error as { code?: string }).code;
	return (
		code === 'SQLITE_CONSTRAINT_UNIQUE' ||
		(error instanceof Error && error.message.includes('UNIQUE constraint failed'))
	);
}

function uniqueViolation(error: unknown): 'avatar' | 'jersey' | null {
	if (!isUniqueConstraint(error)) return null;
	const message = error instanceof Error ? error.message : '';
	if (message.includes('players.jersey_number')) return 'jersey';
	if (message.includes('players.avatar_id')) return 'avatar';
	return null;
}

/**
 * Un numéro de chandail actif ne peut pas être réservé deux fois. La lecture
 * et l'écriture partagent la transaction de l'appelant; l'index partiel reste
 * le juge final quand deux écritures se croisent.
 */
function jerseyTaken(
	executor: ReadExecutor,
	jerseyNumber: number,
	excludeUserId: string
): boolean {
	return (
		executor
			.select({ userId: players.userId })
			.from(players)
			.where(
				and(
					eq(players.jerseyNumber, jerseyNumber),
					eq(players.active, true),
					ne(players.userId, excludeUserId)
				)
			)
			.get() !== undefined
	);
}

/** Réservation précoce, avant de créer un compte d'authentification. */
export function isJerseyNumberTaken(jerseyNumber: number): boolean {
	return jerseyTaken(db, jerseyNumber, '');
}

/**
 * Choisit la première identité libre pour le poste et l'écrit dans la même
 * transaction. Le catalogue épuisé est une erreur explicite : une fiche active
 * ne porte jamais une identité nulle.
 */
export function insertPlayerWithNextAvatar(
	row: Omit<NewPlayerRow, 'avatarId'>,
	position: Position
): InsertPlayerResult {
	try {
		return db.transaction((tx) => {
			if (row.jerseyNumber != null && jerseyTaken(tx, row.jerseyNumber, row.userId)) {
				return { status: 'jersey-taken' as const };
			}
			const avatarId = firstFreeAvatarId(takenAvatarIds(tx), position);
			if (!avatarId) return { status: 'no-identity' as const };
			tx.insert(players).values({ ...row, avatarId }).run();
			return { status: 'inserted' as const, avatarId };
		});
	} catch (error) {
		const violation = uniqueViolation(error);
		if (violation === 'jersey') return { status: 'jersey-taken' };
		if (violation === 'avatar') return { status: 'avatar-taken' };
		if (isUniqueConstraint(error)) return { status: 'avatar-taken' };
		throw error;
	}
}

export function hasFreeAvatarForPosition(position: Position): boolean {
	return firstFreeAvatarId(takenAvatarIds(db), position) !== null;
}

export function countActiveAdmins(): number {
	const row = db
		.select({ count: sql<number>`count(*)` })
		.from(players)
		.innerJoin(user, eq(user.id, players.userId))
		.where(and(eq(players.active, true), eq(user.role, ADMIN_ROLE)))
		.get();
	return row?.count ?? 0;
}

export type PlayerPatch = Partial<
	Pick<
		PlayerRow,
		| 'firstName'
		| 'lastName'
		| 'position'
		| 'age'
		| 'jerseyNumber'
		| 'avatarId'
		| 'isSubstitute'
		| 'active'
	>
>;

export type PlayerUpdateOptions = {
	deactivate?: {
		today: string;
		nowTime: string;
	};
};

export type PlayerUpdateResult =
	| { status: 'updated'; cleared: string[] }
	| { status: 'not-found' }
	| { status: 'identity-position' }
	| { status: 'avatar-taken' }
	| { status: 'jersey-taken' }
	| { status: 'no-identity' };

/**
 * Met à jour le joueur et, si son poste change, supprime dans la même
 * transaction les critères de position qui ne s'appliquent plus. Une identité
 * choisie est réservée dans cette même transaction : la lecture de
 * disponibilité et l'écriture ne peuvent pas être séparées par une autre
 * réservation. La désactivation retire aussi, atomiquement, les engagements
 * futurs du joueur.
 */
function applyUpdate(
	tx: DbExecutor,
	playerId: string,
	patch: PlayerPatch,
	options: PlayerUpdateOptions
): PlayerUpdateResult {
		const current = tx
		.select()
		.from(players)
		.where(eq(players.userId, playerId))
		.get();
	if (!current) return { status: 'not-found' };

	const next = { ...patch };
	const effectivePosition = next.position ?? current.position;
	const currentAvatar = next.avatarId !== undefined ? next.avatarId : current.avatarId;
	// L'invariant vaut pour toute écriture, pas seulement quand le poste ou
	// l'identité change : enregistrer un numéro de chandail ne peut pas
	// entériner une légende du mauvais poste, et une activation non plus.
	if (
		currentAvatar !== null &&
		!identityAllowedForPosition(currentAvatar as IdentityId, effectivePosition)
	) {
		return { status: 'identity-position' };
	}

	// Une identité retirée du catalogue ou absente ne peut pas redevenir
	// active telle quelle : l'activation en réserve une libre.
	const validAvatar =
		currentAvatar !== null && isIdentityId(currentAvatar) ? currentAvatar : null;
	if (next.active === true && validAvatar === null) {
		const free = firstFreeAvatarId(takenAvatarIds(tx), effectivePosition);
		if (!free) return { status: 'no-identity' };
		next.avatarId = free;
	}

	// Le numéro suit le même invariant que l'identité : un joueur actif en
	// réserve un seul, et une activation revalide le numéro hérité.
	const effectiveJersey =
		next.jerseyNumber !== undefined ? next.jerseyNumber : current.jerseyNumber;
	const effectiveActive = next.active !== undefined ? next.active : current.active;
	if (
		effectiveActive &&
		effectiveJersey !== null &&
		jerseyTaken(tx, effectiveJersey, playerId)
	) {
		return { status: 'jersey-taken' };
	}

	const claimedAvatar =
		next.avatarId !== undefined
			? next.avatarId
			: next.active === true
				? validAvatar
				: null;
	if (claimedAvatar !== null) {
		const conflict = tx
			.select({ userId: players.userId })
			.from(players)
			.where(
				and(
					eq(players.avatarId, claimedAvatar),
					ne(players.userId, playerId)
				)
			)
			.get();
		if (conflict) return { status: 'avatar-taken' };
	}

	let cleared: string[] = [];
	if (next.position !== undefined && current.position !== next.position) {
		const stored = tx
			.select({ attribute: playerRatings.attribute })
			.from(playerRatings)
			.where(eq(playerRatings.playerId, playerId))
			.all()
			.map((row) => row.attribute);
		cleared = positionRatingKeysToClear(next.position, stored);
		if (cleared.length > 0) {
			tx.delete(playerRatings)
				.where(
					and(
						eq(playerRatings.playerId, playerId),
						inArray(playerRatings.attribute, cleared as PlayerRatingRow['attribute'][])
					)
				)
				.run();
		}
	}

	if (Object.keys(next).length > 0) {
		tx.update(players)
			.set({ ...next, updatedAt: clock.nowMs() })
			.where(eq(players.userId, playerId))
			.run();
	}

	if (options.deactivate) {
		clearFutureCommitments(tx, playerId, options.deactivate);
	}

	return { status: 'updated', cleared };
}

export function updatePlayer(
	playerId: string,
	patch: PlayerPatch,
	options: PlayerUpdateOptions = {},
	executor: DbExecutor = db
): PlayerUpdateResult {
	try {
		if (executor === db) {
			return db.transaction((tx) => applyUpdate(tx, playerId, patch, options));
		}
		return applyUpdate(executor, playerId, patch, options);
	} catch (error) {
		const violation = uniqueViolation(error);
		if (violation === 'jersey') return { status: 'jersey-taken' };
		if (violation === 'avatar') return { status: 'avatar-taken' };
		if (isUniqueConstraint(error)) return { status: 'avatar-taken' };
		throw error;
	}
}

/**
 * Retire le joueur des matchs qui n'ont pas commencé. Les faits historiques
 * (matchs passés, terminés ou annulés) restent intacts.
 */
function clearFutureCommitments(
	tx: DbExecutor,
	playerId: string,
	window: NonNullable<PlayerUpdateOptions['deactivate']>
): void {
	const now = clock.nowMs();
	const futureIds = tx
		.select({ id: games.id })
		.from(games)
		.where(
			and(
				eq(games.status, 'scheduled'),
				or(
					gt(games.gameDate, window.today),
					and(eq(games.gameDate, window.today), gt(games.startTime, window.nowTime))
				)
			)
		)
		.all()
		.map((row) => row.id);
	if (futureIds.length === 0) return;

	tx.update(gameSlots)
		.set({ assignedPlayerId: null, assignmentKind: null, updatedAt: now })
		.where(
			and(
				eq(gameSlots.assignedPlayerId, playerId),
				inArray(gameSlots.gameId, futureIds)
			)
		)
		.run();
	tx.delete(gameAvailability)
		.where(
			and(
				eq(gameAvailability.playerId, playerId),
				inArray(gameAvailability.gameId, futureIds)
			)
		)
		.run();
	tx.update(subRequests)
		.set({ status: 'open', filledByPlayerId: null, filledAt: null })
		.where(
			and(
				eq(subRequests.filledByPlayerId, playerId),
				inArray(subRequests.gameId, futureIds)
			)
		)
		.run();
}

/**
 * Supprime un compte joueur en conservant son histoire. La fiche reste en base,
 * anonymisée et inactive, parce que les paiements, les places jouées et les buts
 * la référencent. Le compte d'authentification perd ses identifiants et ses
 * sessions; les engagements futurs (places, présence, demandes de
 * remplacement) sont libérés, mais les faits passés ne sont jamais réécrits.
 */
export function deletePlayerAccount(
	playerId: string,
	today: string,
	nowTime: string,
	executor: DbExecutor = db
): void {
	if (executor === db) {
		db.transaction((tx) => deletePlayerAccount(playerId, today, nowTime, tx));
		return;
	}
	const tx = executor;
	const now = clock.nowMs();
	const firstName = t('player.deletedFirstName');
	const lastName = t('player.deletedLastName');
	const fullName = t('player.deletedName');

	tx.update(players)
		.set({
			firstName,
			lastName,
			active: false,
			isSubstitute: false,
			avatarId: null,
			jerseyNumber: null,
			deletedAt: now,
			updatedAt: now
		})
		.where(eq(players.userId, playerId))
		.run();

	// Le compte garde sa ligne (les clés étrangères des faits passés en
	// dépendent) mais perd son adresse, son nom affiché et ses identifiants.
	tx.update(user)
		.set({
			name: fullName,
			email: `supprime+${playerId}@invalide.local`,
			banned: true,
			banReason: 'Compte supprimé',
			banExpires: null
		})
		.where(eq(user.id, playerId))
		.run();
	tx.delete(session).where(eq(session.userId, playerId)).run();
	tx.delete(account).where(eq(account.userId, playerId)).run();
	tx.delete(subProfiles).where(eq(subProfiles.playerId, playerId)).run();

	// Une place reprise sur un match à venir redevient disponible. Sur un
	// match passé ou annulé, elle est fermée pour conserver l'historique.
	const futureIds = tx
		.select({ id: games.id })
		.from(games)
		.where(
			and(
				eq(games.status, 'scheduled'),
				or(
					gt(games.gameDate, today),
					and(eq(games.gameDate, today), gt(games.startTime, nowTime))
				)
			)
		)
		.all()
		.map((row) => row.id);

	if (futureIds.length > 0) {
		tx.update(gameSlots)
			.set({ assignedPlayerId: null, assignmentKind: null, updatedAt: now })
			.where(
				and(
					eq(gameSlots.assignedPlayerId, playerId),
					inArray(gameSlots.gameId, futureIds)
				)
			)
			.run();
		tx.delete(gameAvailability)
			.where(
				and(
					eq(gameAvailability.playerId, playerId),
					inArray(gameAvailability.gameId, futureIds)
				)
			)
			.run();
		tx.update(subRequests)
			.set({ status: 'open', filledByPlayerId: null, filledAt: null })
			.where(
				and(
					eq(subRequests.filledByPlayerId, playerId),
					inArray(subRequests.gameId, futureIds)
				)
			)
			.run();
		tx.update(subRequests)
			.set({ status: 'cancelled', cancelledAt: now })
			.where(
				and(
					eq(subRequests.requestedByPlayerId, playerId),
					inArray(subRequests.gameId, futureIds)
				)
			)
			.run();
	}
}
