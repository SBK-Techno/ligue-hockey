import { requirePermission } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
import { playerCandidatesByIds } from '#lib/domain/players/candidates.ts';
import { AppError } from '#lib/shared/errors.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import { buildGenerationSnapshot, validateAssignments } from './alignment.ts';
import { isLineupEditable } from './playability.ts';
import { benchFromMembers, lineupPool, type PoolSlot } from './pool.ts';
import {
	findGame,
	listSlotAssignments,
	saveAssignments,
	type SlotAssignment
} from './queries.ts';
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
 * La vue de l'éditeur : places et banc lus sur le bassin vivant, le même que
 * celui de l'enregistrement. Après un alignement manuel, la régénération est
 * bloquée; un joueur retiré quitte donc la glace et un remplaçant réclamé
 * apparaît au banc sans attendre un recalcul.
 */
export function lineupBoardView(game: GameView): GameView {
	if (!game.generation) return game;
	const row = findGame(game.id);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	const pool = lineupPool(row, poolSlotsOf(game.slots));
	const live = new Set(pool.members.map((member) => member.playerId));
	const members = new Map(pool.members.map((member) => [member.playerId, member]));

	return {
		...game,
		slots: game.slots.map((slot) =>
			slot.player && !live.has(slot.player.playerId)
				? { ...slot, player: null }
				: slot
		),
		generation: {
			...game.generation,
			bench: pool.bench.map((entry) => ({
				playerId: entry.playerId,
				fullName: pool.names.get(entry.playerId) ?? entry.playerId,
				position: entry.position,
				jerseyNumber: members.get(entry.playerId)?.jerseyNumber ?? null,
				avatarId: members.get(entry.playerId)?.avatarId ?? null,
				kind: entry.kind
			}))
		}
	};
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
	if (row.generatedAt === null) {
		throw new AppError('CONFLICT', { key: 'rating.gameNotGenerated' });
	}

	const currentSlots = listSlotAssignments(gameId);
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
	const writtenSlots = validateAssignments(currentSlots, parsed.assignments, names);
	if (writtenSlots.size !== currentSlots.length) {
		throw new AppError('VALIDATION', { key: 'games.lineupIncomplete' });
	}
	const assignedPlayers = new Set(chosen.map((assignment) => assignment.playerId));

	// La présence et les réclamations viennent du même bassin vivant que la
	// vue de l'éditeur : une lecture ne peut pas accepter un joueur que
	// l'autre n'a jamais montré.
	const pool = lineupPool(
		row,
		currentSlots.map((slot) => ({
			team: slot.team,
			position: slot.position,
			slotIndex: slot.slotIndex,
			player:
				slot.playerId && slot.assignmentKind
					? { playerId: slot.playerId, kind: slot.assignmentKind }
					: null
		}))
	);
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
		if (!member.eligiblePositions.includes(assignment.position)) {
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
		openSlots: currentSlots.length - assignments.length
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
				auditEntry(actor, {
					action: 'ratings.game_removed',
					entityType: 'game',
					entityId: gameId,
					metadata: { playerIds }
				}),
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
