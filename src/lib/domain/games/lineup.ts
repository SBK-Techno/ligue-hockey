import { canFillPosition } from '#config/positions.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
import { playerCandidatesByIds } from '#lib/domain/players/candidates.ts';
import { AppError } from '#lib/shared/errors.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import { buildGenerationSnapshot, validateAssignments } from './alignment.ts';
import { ratingsRemovedAudit } from './audit.ts';
import { isLineupEditable } from './playability.ts';
import { isPublished } from './published.ts';
import { benchFromMembers, lineupPool, type PoolSlot } from './pool.ts';
import { findGame, saveAssignments, type SlotAssignment } from './queries.ts';
import { getGame, type GameView } from './service.ts';
import type { GameSlotView } from './types.ts';
import {
	manualLineupInputSchema,
	type ManualLineupAssignment,
	type ManualLineupInput
} from './validators.ts';

function poolSlotsOf(slots: readonly GameSlotView[]): PoolSlot[] {
	return slots.map((slot) => ({
		team: slot.team,
		position: slot.position,
		slotIndex: slot.slotIndex,
		player: slot.player
			? { playerId: slot.player.playerId, kind: slot.player.kind }
			: null
	}));
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
	if (!isPublished(row)) {
		throw new AppError('CONFLICT', { key: 'rating.gameNotGenerated' });
	}

	// L'univers des places et la présence viennent de la vue publiée : le
	// même bassin vivant décide de ce que l'éditeur montre et accepte.
	const currentSlots = poolSlotsOf(getGame(actor, gameId).slots);
	const declared = currentSlots.map((slot) => ({
		team: slot.team,
		position: slot.position,
		slotIndex: slot.slotIndex,
		playerId: slot.player?.playerId ?? null
	}));
	const chosen = parsed.assignments.filter(
		(assignment): assignment is ManualLineupAssignment & { playerId: string } =>
			assignment.playerId !== null
	);
	const details = playerCandidatesByIds([
		...new Set(chosen.map((assignment) => assignment.playerId))
	]);
	const byId = new Map(details.map((player) => [player.userId, player]));
	const names = new Map(details.map((player) => [player.userId, player.fullName]));

	// Une formation partielle ne doit jamais ressembler à une mise à blanc :
	// chaque place du match est présente, vide comprise. La validation et
	// l'univers des places sont ceux des gestes internes.
	const writtenSlots = validateAssignments(declared, parsed.assignments, names);
	if (writtenSlots.size !== declared.length) {
		throw new AppError('VALIDATION', { key: 'games.lineupIncomplete' });
	}
	const assignedPlayers = new Set(chosen.map((assignment) => assignment.playerId));

	// La présence et les réclamations viennent du même bassin vivant que la
	// vue de l'éditeur : une lecture ne peut pas accepter un joueur que
	// l'autre n'a jamais montré.
	const pool = lineupPool(row, currentSlots);
	const members = new Map(pool.members.map((member) => [member.playerId, member]));

	const assignments: SlotAssignment[] = chosen.map((assignment) => {
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
		const member = members.get(assignment.playerId);
		if (!member) {
			throw new AppError('VALIDATION', {
				key: 'games.lineupPlayerAbsent',
				params: { name: player.fullName }
			});
		}
		if (!canFillPosition(member.eligiblePositions, assignment.position)) {
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
			kind: member.kind
		};
	});

	const bench = benchFromMembers(pool.members, assignedPlayers);
	const built = buildGenerationSnapshot({
		assignments,
		bench,
		openSlots: declared.length - assignments.length
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

	const saved = saveAssignments(
		gameId,
		assignments,
		built.generatedAt,
		JSON.stringify(built.snapshot),
		built.generatedAt,
		{
			expectedGeneratedAt: parsed.expectedGeneratedAt,
			manualAt: built.generatedAt,
			ratingsAudit: (playerIds) =>
				ratingsRemovedAudit(actor, gameId, playerIds),
			audits: [
				auditEntry(actor, {
					action: 'game.lineup_manual',
					entityType: 'game',
					entityId: gameId,
					metadata: {
						assignments: assignments.length,
						warnings: built.snapshot.warnings
					}
				})
			]
		}
	);
	if (!saved) {
		throw new AppError('CONFLICT', { key: 'games.lineupChanged' });
	}

	return getGame(actor, gameId);
}
