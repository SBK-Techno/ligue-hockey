import { isPosition, type Position } from '#config/positions.ts';
import { branding } from '#lib/generated/branding.ts';
import { listUserIdsWithCapability } from '#lib/domain/auth/queries.ts';
import { can, requirePermission, requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { generationCandidates, playersByIds } from '#lib/domain/players/candidates.ts';
import {
	findOwnProfile,
	getOwnProfile,
	getPlayer,
	type SelfProfile
} from '#lib/domain/players/service.ts';
import { notify } from '#lib/domain/notifications/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';
import { isLineupEditable } from '#lib/domain/games/playability.ts';
import { AppError } from '#lib/shared/errors.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { clock, todayInZone, zonedDateTimeToMs } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import {
	claimablePositions,
	computeSubRequestWaves,
	isTooLateForSubRequest
} from './policy.ts';
import {
	cancelRequest,
	claimRequest,
	findRequest,
	findRequesterRequest,
	findSubProfile,
	insertRequest,
	listClaimedSubs,
	listOpenRequests,
	listRequestsForGame,
	listRequestsForUser,
	listSubProfiles,
	releaseRequest,
	upsertSubProfile
} from './queries.ts';
import type { SubRequestRow, SubRequestStatus } from './schema.ts';
import { subFavoriteInputSchema, subProfileInputSchema } from './validators.ts';

export type SubRequestView = {
	id: string;
	gameId: string;
	position: Position;
	reason: SubRequestRow['reason'];
	status: SubRequestStatus;
	requestedByPlayerId: string | null;
	requestedByName: string | null;
	filledByPlayerId: string | null;
	filledByName: string | null;
	createdAt: number;
	filledAt: number | null;
	cancelledAt: number | null;
};

export type SubProfileView = {
	playerId: string;
	fullName: string;
	positions: Position[];
	favorite?: boolean;
};

export type WaveSchedule = {
	favoriteAt: number;
	generalAt: number;
	tooLate: boolean;
	favoriteCount: number;
	generalCount: number;
};

function parsePositions(json: string): Position[] {
	try {
		const parsed: unknown = JSON.parse(json);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((value): value is Position => typeof value === 'string' && isPosition(value));
	} catch {
		return [];
	}
}

function gameStartMs(game: GameSummary): number {
	return zonedDateTimeToMs(game.gameDate, game.startTime, branding.timezone);
}

function requestView(
	request: SubRequestRow,
	names: Map<string, string>
): SubRequestView {
	return {
		id: request.id,
		gameId: request.gameId,
		position: request.position,
		reason: request.reason,
		status: request.status,
		requestedByPlayerId: request.requestedByPlayerId,
		requestedByName: request.requestedByPlayerId
			? (names.get(request.requestedByPlayerId) ?? null)
			: null,
		filledByPlayerId: request.filledByPlayerId,
		filledByName: request.filledByPlayerId
			? (names.get(request.filledByPlayerId) ?? null)
			: null,
		createdAt: request.createdAt,
		filledAt: request.filledAt,
		cancelledAt: request.cancelledAt
	};
}

function namesFor(requests: readonly SubRequestRow[]): Map<string, string> {
	const ids = new Set<string>();
	for (const request of requests) {
		if (request.requestedByPlayerId) ids.add(request.requestedByPlayerId);
		if (request.filledByPlayerId) ids.add(request.filledByPlayerId);
	}
	return new Map(playersByIds([...ids]).map((player) => [player.userId, player.fullName]));
}

export function getMySubProfile(actor: Actor): { positions: Position[] } {
	const user = requireUser(actor);
	const profile = findSubProfile(user.userId);
	const player = findOwnProfile(user);
	return {
		positions: claimablePositions(
			profile ? parsePositions(profile.positionsJson) : [],
			player?.position ?? null
		)
	};
}

export function saveMySubProfile(
	actor: Actor,
	input: { positions: unknown }
): { positions: Position[] } {
	const user = requireUser(actor);
	const parsed = parseSchema(subProfileInputSchema, input);
	const positions = [...new Set(parsed.positions)];
	const existing = findSubProfile(user.userId);

	upsertSubProfile({
		playerId: user.userId,
		favorite: existing?.favorite ?? false,
		positionsJson: JSON.stringify(positions),
		updatedAt: clock.nowMs()
	});

	return { positions };
}

export function setSubstituteFavorite(
	actor: Actor,
	input: { playerId: string; favorite: unknown }
): void {
	requirePermission(actor, 'managePlayers');
	const parsed = parseSchema(subFavoriteInputSchema, input);
	const player = getPlayer(actor, parsed.playerId);
	if (!('age' in player) || !player.isSubstitute) {
		throw new AppError('VALIDATION', { key: 'subs.notSubstitute' });
	}

	const existing = findSubProfile(parsed.playerId);
	upsertSubProfile({
		playerId: parsed.playerId,
		favorite: parsed.favorite,
		positionsJson:
			existing?.positionsJson ?? JSON.stringify([player.position]),
		updatedAt: clock.nowMs()
	});
	recordAudit(actor, {
		action: 'sub.favorite',
		entityType: 'player',
		entityId: parsed.playerId,
		metadata: { favorite: parsed.favorite }
	});
}

export function listSubstitutes(actor: Actor): SubProfileView[] {
	const user = requireUser(actor);
	const profiles = new Map(
		listSubProfiles().map((profile) => [profile.playerId, profile])
	);

	return generationCandidates()
		.filter((player) => player.isSubstitute)
		.map((player) => {
			const profile = profiles.get(player.userId);
			const positions = profile
				? parsePositions(profile.positionsJson)
				: [player.position];
			return {
				playerId: player.userId,
				fullName: player.fullName,
				positions: positions.length > 0 ? positions : [player.position],
				...(can(user, 'viewAdmin')
					? { favorite: profile?.favorite ?? false }
					: {})
			};
		})
		.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function eligibleSubs(
	gameId: string,
	position: Position,
	excludePlayerId: string | null
): { favorites: string[]; general: string[] } {
	const profiles = new Map(
		listSubProfiles().map((profile) => [profile.playerId, profile])
	);
	const claimed = new Set(
		listClaimedSubs(gameId)
			.map((row) => row.playerId)
			.filter((playerId): playerId is string => playerId !== null)
	);
	const favorites: string[] = [];
	const general: string[] = [];

	for (const player of generationCandidates()) {
		if (!player.isSubstitute || !player.active) continue;
		if (excludePlayerId && player.userId === excludePlayerId) continue;
		if (claimed.has(player.userId)) continue;
		const profile = profiles.get(player.userId);
		const positions = profile
			? parsePositions(profile.positionsJson)
			: [player.position];
		if (!positions.includes(position)) continue;
		if (profile?.favorite) {
			favorites.push(player.userId);
		} else {
			general.push(player.userId);
		}
	}

	return { favorites, general };
}

export function notifyRequestWaves(
	request: SubRequestRow,
	game: GameSummary
): WaveSchedule {
	const settings = getSettings();
	const now = clock.nowMs();
	const start = gameStartMs(game);
	const tooLate = isTooLateForSubRequest(
		start,
		now,
		settings['notifications.lastCallMinutes']
	);

	const waves = computeSubRequestWaves({
		gameStartMs: start,
		nowMs: now,
		generalLeadHours: settings['notifications.generalLeadHours'],
		priorityGapHours: settings['notifications.priorityGapHours'],
		lastCallMinutes: settings['notifications.lastCallMinutes']
	});

	const recipients = eligibleSubs(
		game.id,
		request.position,
		request.requestedByPlayerId
	);

	const dedupeRoot = request.requestedByPlayerId
		? `sub_request:${request.gameId}:${request.requestedByPlayerId}:${todayInZone(
				branding.timezone,
				now
			)}`
		: `sub_request:${request.id}`;

	if (!tooLate) {
		notify(
			'sub_request',
			recipients.favorites.map((userId) => ({ userId })),
			{
				gameId: game.id,
				requestId: request.id,
				position: request.position,
				gameDate: game.gameDate,
				startTime: game.startTime,
				location: game.location
			},
			{
				dedupeKey: `${dedupeRoot}:favorite`,
				scheduledFor: waves.favoriteAt
			}
		);

		notify(
			'sub_request',
			recipients.general.map((userId) => ({ userId })),
			{
				gameId: game.id,
				requestId: request.id,
				position: request.position,
				gameDate: game.gameDate,
				startTime: game.startTime,
				location: game.location
			},
			{
				dedupeKey: `${dedupeRoot}:general`,
				scheduledFor: waves.generalAt
			}
		);
	}

	return {
		...waves,
		tooLate,
		favoriteCount: recipients.favorites.length,
		generalCount: recipients.general.length
	};
}

export function createAbsenceRequest(
	actor: Actor,
	game: GameSummary,
	player: SelfProfile
): SubRequestView | null {
	if (player.isSubstitute) return null;

	const existing = findRequesterRequest(game.id, player.userId);
	if (existing) {
		return requestView(existing, namesFor([existing]));
	}

	const now = clock.nowMs();
	const id = newId('sub');
	insertRequest({
		id,
		gameId: game.id,
		requestedByPlayerId: player.userId,
		createdByUserId: actor.kind === 'user' ? actor.userId : null,
		position: player.position,
		reason: 'absence',
		status: 'open',
		createdAt: now
	});
	const created = findRequest(id);
	if (!created) {
		throw new AppError('INTERNAL');
	}
	notifyRequestWaves(created, game);
	recordAudit(actor, {
		action: 'sub.request_created',
		entityType: 'sub_request',
		entityId: id,
		metadata: { gameId: game.id, position: player.position, reason: 'absence' }
	});
	return requestView(created, namesFor([created]));
}

export function createManualRequest(
	actor: Actor,
	game: GameSummary,
	position: Position
): SubRequestView {
	requirePermission(actor, 'manageSubs');
	if (!isLineupEditable(game)) {
		throw new AppError('CONFLICT', { key: 'subs.gameNotScheduled' });
	}

	const now = clock.nowMs();
	const id = newId('sub');
	insertRequest({
		id,
		gameId: game.id,
		createdByUserId: actor.kind === 'user' ? actor.userId : null,
		position,
		reason: 'manual',
		status: 'open',
		createdAt: now
	});
	const created = findRequest(id);
	if (!created) {
		throw new AppError('INTERNAL');
	}
	notifyRequestWaves(created, game);
	recordAudit(actor, {
		action: 'sub.request_created',
		entityType: 'sub_request',
		entityId: id,
		metadata: { gameId: game.id, position, reason: 'manual' }
	});
	return requestView(created, namesFor([created]));
}

export type ClaimResult = {
	requestId: string;
	gameId: string;
	position: Position;
};

export function claimSubstitute(
	actor: Actor,
	game: GameSummary,
	requestId: string
): ClaimResult {
	const user = requireUser(actor);
	const player = getOwnProfile(actor);
	if (!player.isSubstitute) {
		throw new AppError('FORBIDDEN', { key: 'subs.notEligible' });
	}

	const request = findRequest(requestId);
	if (!request || request.gameId !== game.id) {
		throw new AppError('NOT_FOUND', { key: 'subs.requestNotFound' });
	}
	if (request.status !== 'open') {
		throw new AppError('CONFLICT', { key: 'subs.claimTaken' });
	}
	if (clock.nowMs() >= gameStartMs(game)) {
		throw new AppError('CONFLICT', { key: 'subs.gameStarted' });
	}

	const profile = findSubProfile(user.userId);
	const positions = claimablePositions(
		profile ? parsePositions(profile.positionsJson) : [],
		player.position
	);
	if (!positions.includes(request.position)) {
		throw new AppError('FORBIDDEN', { key: 'subs.notEligible' });
	}

	let claimed: boolean;
	try {
		claimed = claimRequest(requestId, user.userId, clock.nowMs());
	} catch (cause) {
		throw new AppError('CONFLICT', {
			key: 'subs.alreadyPlaying',
			cause
		});
	}
	if (!claimed) {
		throw new AppError('CONFLICT', { key: 'subs.claimTaken' });
	}

	const recipients = new Set(listUserIdsWithCapability('manageSubs'));
	if (request.requestedByPlayerId) {
		recipients.add(request.requestedByPlayerId);
	}
	recipients.delete(user.userId);
	notify(
		'sub_claimed',
		[...recipients].map((userId) => ({ userId })),
		{
			gameId: game.id,
			position: request.position,
			playerName: player.fullName,
			gameDate: game.gameDate,
			startTime: game.startTime
		},
		{ dedupeKey: `sub_claimed:${requestId}` }
	);

	recordAudit(actor, {
		action: 'sub.claimed',
		entityType: 'sub_request',
		entityId: requestId,
		metadata: { gameId: game.id, position: request.position }
	});

	return { requestId, gameId: game.id, position: request.position };
}

export function releaseSubstitute(
	actor: Actor,
	game: GameSummary,
	requestId: string
): WaveSchedule {
	const user = requireUser(actor);
	const request = findRequest(requestId);
	if (!request || request.gameId !== game.id) {
		throw new AppError('NOT_FOUND', { key: 'subs.requestNotFound' });
	}
	// Une place ne se libère pas une fois le match commencé.
	if (!isLineupEditable(game)) {
		throw new AppError('CONFLICT', { key: 'subs.gameStarted' });
	}

	if (!releaseRequest(requestId, user.userId)) {
		throw new AppError('FORBIDDEN');
	}

	recordAudit(actor, {
		action: 'sub.released',
		entityType: 'sub_request',
		entityId: requestId
	});

	const reopened = findRequest(requestId);
	if (!reopened) {
		throw new AppError('INTERNAL');
	}
	return notifyRequestWaves(reopened, game);
}

export function cancelRequestByAdmin(
	actor: Actor,
	game: GameSummary,
	requestId: string
): string | null {
	requirePermission(actor, 'manageSubs');
	const request = findRequest(requestId);
	if (!request || request.gameId !== game.id) {
		throw new AppError('NOT_FOUND', { key: 'subs.requestNotFound' });
	}
	return cancelRequestWithEffects(actor, game, request);
}

/**
 * Un joueur peut retirer sa propre demande tant que le match n'a pas commencé.
 * La permission de gestion reste réservée aux gestionnaires.
 */
export function cancelOwnRequest(
	actor: Actor,
	game: GameSummary,
	requestId: string
): string | null {
	const user = requireUser(actor);
	const request = findRequest(requestId);
	if (!request || request.gameId !== game.id) {
		throw new AppError('NOT_FOUND', { key: 'subs.requestNotFound' });
	}
	if (request.requestedByPlayerId !== user.userId) {
		throw new AppError('FORBIDDEN', { key: 'subs.notRequester' });
	}
	if (!isLineupEditable(game)) {
		throw new AppError('CONFLICT', { key: 'subs.requestNotActive' });
	}
	return cancelRequestWithEffects(actor, game, request);
}

function cancelRequestWithEffects(
	actor: Actor,
	game: GameSummary,
	request: NonNullable<ReturnType<typeof findRequest>>
): string | null {
	const bumpedPlayerId = request.filledByPlayerId;
	if (!cancelRequest(request.id, clock.nowMs())) {
		throw new AppError('CONFLICT', { key: 'subs.requestNotActive' });
	}

	if (bumpedPlayerId) {
		notify(
			'sub_bumped',
			[{ userId: bumpedPlayerId }],
			{
				gameId: game.id,
				position: request.position,
				gameDate: game.gameDate,
				startTime: game.startTime
			},
			{ dedupeKey: `sub_bumped:${request.id}:cancelled` }
		);
	}

	recordAudit(actor, {
		action: 'sub.request_cancelled',
		entityType: 'sub_request',
		entityId: request.id
	});
	return bumpedPlayerId;
}

export function cancelForReturn(
	actor: Actor,
	game: GameSummary,
	playerId: string
): string | null {
	const request = findRequesterRequest(game.id, playerId);
	if (!request) return null;
	const bumpedPlayerId = request.filledByPlayerId;
	if (!cancelRequest(request.id, clock.nowMs())) {
		return null;
	}

	if (bumpedPlayerId) {
		notify(
			'sub_bumped',
			[{ userId: bumpedPlayerId }],
			{
				gameId: game.id,
				position: request.position,
				gameDate: game.gameDate,
				startTime: game.startTime
			},
			{ dedupeKey: `sub_bumped:${request.id}:regular-returned` }
		);
	}

	recordAudit(actor, {
		action: 'sub.request_cancelled',
		entityType: 'sub_request',
		entityId: request.id,
		metadata: { reason: 'regular-returned', playerId }
	});
	return bumpedPlayerId;
}

export function listGameRequests(
	actor: Actor,
	game: GameSummary
): SubRequestView[] {
	requireUser(actor);
	const requests = listRequestsForGame(game.id).filter(
		(request) => request.status !== 'cancelled'
	);
	const names = namesFor(requests);
	return requests.map((request) => requestView(request, names));
}

export function listOpenRequestsForMember(actor: Actor): SubRequestView[] {
	requireUser(actor);
	const requests = listOpenRequests();
	const names = namesFor(requests);
	return requests.map((request) => requestView(request, names));
}

export function listMyRequests(actor: Actor): SubRequestView[] {
	const user = requireUser(actor);
	const all = listRequestsForUser(user.userId);
	const names = namesFor(all);
	return all.map((request) => requestView(request, names));
}

