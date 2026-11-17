import { POSITIONS, type Position } from '#config/positions.ts';
import { buildSlotDefinitions, type SlotDefinition } from '#config/roster.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
import { playerCandidatesByIds } from '#lib/domain/players/candidates.ts';
import { listGameRatingPlayerIds } from '#lib/domain/ratings/queries.ts';
import { claimsForGeneration } from '#lib/domain/subs/generation.ts';
import { listSubstitutes } from '#lib/domain/subs/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import { buildGenerationSnapshot } from './alignment.ts';
import { isLineupEditable } from './playability.ts';
import { templateFromRow } from './pool.ts';
import {
	findGame,
	listAvailability,
	saveAssignments,
	type SlotAssignment
} from './queries.ts';
import { getGame, type GameView } from './service.ts';
import {
	manualLineupInputSchema,
	type ManualLineupInput
} from './validators.ts';

const POSITION_INDEX = new Map<Position, number>(
	POSITIONS.map((position, index) => [position.key, index])
);

function slotKey(slot: {
	team: string;
	position: Position;
	slotIndex: number;
}): string {
	return `${slot.team}:${slot.position}:${slot.slotIndex}`;
}

function inlineBench(
	presentIds: readonly string[],
	details: ReturnType<typeof playerCandidatesByIds>,
	assigned: ReadonlySet<string>
) {
	const byId = new Map(details.map((player) => [player.userId, player]));
	const entries: {
		playerId: string;
		position: Position;
		kind: 'regular' | 'sub';
	}[] = [];
	for (const playerId of presentIds) {
		if (assigned.has(playerId)) continue;
		const player = byId.get(playerId);
		if (!player || !player.active) continue;
		entries.push({
			playerId,
			position: player.position,
			kind: player.isSubstitute ? 'sub' : 'regular'
		});
	}
	return entries.sort(
		(a, b) =>
			(POSITION_INDEX.get(a.position) ?? 0) -
				(POSITION_INDEX.get(b.position) ?? 0) ||
			a.kind.localeCompare(b.kind) ||
			a.playerId.localeCompare(b.playerId)
	);
}

/**
 * Enregistre l'alignement composé à la main. Le jeton `expectedGeneratedAt`
 * protège la lecture du gestionnaire : si une autre écriture a publié une
 * génération entre-temps, rien n'est remplacé et la page doit être rechargée.
 */
export function saveManualLineup(
	actor: Actor,
	gameId: string,
	input: ManualLineupInput
): GameView {
	requirePermission(actor, 'manageGames');
	const parsed = parseSchema(manualLineupInputSchema, input);
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	if (!isLineupEditable(row)) {
		throw new AppError('CONFLICT', { key: 'games.lineupLocked' });
	}

	const definitions = new Map<string, SlotDefinition>(
		buildSlotDefinitions(templateFromRow(row)).map((slot) => [
			slotKey({ team: slot.team, position: slot.position, slotIndex: slot.index }),
			slot
		])
	);

	const writtenSlots = new Set<string>();
	const assignedPlayers = new Set<string>();
	for (const assignment of parsed.assignments) {
		const key = slotKey(assignment);
		if (!definitions.has(key)) {
			throw new AppError('VALIDATION', { key: 'games.lineupSlotUnknown' });
		}
		if (writtenSlots.has(key)) {
			throw new AppError('VALIDATION', { key: 'games.lineupSlotUnknown' });
		}
		if (assignedPlayers.has(assignment.playerId)) {
			throw new AppError('VALIDATION', { key: 'games.lineupPlayerDuplicate' });
		}
		writtenSlots.add(key);
		assignedPlayers.add(assignment.playerId);
	}

	const availability = listAvailability(gameId).filter(
		(entry) => entry.status === 'present'
	);
	// Un remplaçant réclamé est présent par sa réclamation, même s'il n'a pas
	// de ligne de présence : le bassin vivant le traite déjà comme un membre.
	const claimedSubs = claimsForGeneration(gameId).map((claim) => claim.playerId);
	const presentIds = [
		...new Set([
			...availability.map((entry) => entry.playerId),
			...claimedSubs
		])
	];
	const present = new Set(presentIds);
	const details = playerCandidatesByIds([
		...new Set([...assignedPlayers, ...presentIds])
	]);
	const byId = new Map(details.map((player) => [player.userId, player]));
	const subPositions = new Map(
		listSubstitutes(actor).map((profile) => [profile.playerId, profile.positions])
	);

	const assignments: SlotAssignment[] = parsed.assignments.map((assignment) => {
		const player = byId.get(assignment.playerId);
		if (!player) {
			throw new AppError('VALIDATION', {
				key: 'games.lineupPlayerUnknown',
				params: { id: assignment.playerId }
			});
		}
		if (!player.active) {
			throw new AppError('VALIDATION', {
				key: 'games.lineupPlayerInactive',
				params: { name: player.fullName }
			});
		}
		if (!present.has(assignment.playerId)) {
			throw new AppError('VALIDATION', {
				key: 'games.lineupPlayerAbsent',
				params: { name: player.fullName }
			});
		}
		const eligible =
			player.position === assignment.position ||
			(player.isSubstitute &&
				(subPositions.get(assignment.playerId) ?? []).includes(
					assignment.position
				));
		if (!eligible) {
			throw new AppError('VALIDATION', {
				key: 'games.lineupPositionInvalid',
				params: { name: player.fullName }
			});
		}
		return {
			team: assignment.team,
			position: assignment.position,
			slotIndex: assignment.slotIndex,
			playerId: assignment.playerId,
			kind: player.isSubstitute ? 'sub' : 'regular'
		};
	});

	const bench = inlineBench(presentIds, details, assignedPlayers);
	const built = buildGenerationSnapshot({
		assignments,
		bench,
		openSlots: definitions.size - assignments.length
	});

	const blocked = built.violations.find((violation) => violation.strict);
	if (blocked) {
		throw new AppError('VALIDATION', {
			key: 'games.lineupRuleConflict',
			params: {
				a: built.names.get(blocked.playerIds[0]) ?? blocked.playerIds[0],
				b: built.names.get(blocked.playerIds[1]) ?? blocked.playerIds[1]
			},
			details: {
				ruleId: blocked.ruleId,
				kind: blocked.kind,
				playerIds: blocked.playerIds
			}
		});
	}

	const removedRatedPlayerIds = listGameRatingPlayerIds(gameId).filter(
		(playerId) => !assignedPlayers.has(playerId)
	);
	const saved = saveAssignments(
		gameId,
		assignments,
		built.generatedAt,
		JSON.stringify(built.snapshot),
		built.generatedAt,
		{
			expectedGeneratedAt: parsed.expectedGeneratedAt,
			manualAt: built.generatedAt,
			removedRatedPlayerIds,
			audits: [
				auditEntry(actor, {
					action: 'game.lineup_manual',
					entityType: 'game',
					entityId: gameId,
					metadata: {
						assignments: assignments.length,
						warnings: built.snapshot.warnings
					}
				}),
				...(removedRatedPlayerIds.length > 0
					? [
							auditEntry(actor, {
								action: 'ratings.game_removed',
								entityType: 'game',
								entityId: gameId,
								metadata: { playerIds: removedRatedPlayerIds }
							})
						]
					: [])
			]
		}
	);
	if (!saved) {
		throw new AppError('CONFLICT', { key: 'games.lineupChanged' });
	}

	return getGame(actor, gameId);
}
