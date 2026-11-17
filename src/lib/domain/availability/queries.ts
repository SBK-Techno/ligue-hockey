import type { Position } from '#config/positions.ts';
import type { AuditEntry } from '#lib/domain/audit/queries.ts';
import { insertAudit } from '#lib/domain/audit/queries.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { releasePlayerSlot, upsertAvailability } from '#lib/domain/games/queries.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';
import {
	cancelRequestForReturnIn,
	createAbsenceRequestIn
} from '#lib/domain/subs/generation.ts';
import type { SubRequestRow } from '#lib/domain/subs/schema.ts';
import { db } from '#lib/server/db/index.ts';

export type AvailabilityWriteInput = {
	actor: Actor;
	game: GameSummary;
	playerId: string;
	status: 'present' | 'absent';
	at: number;
	position: Position;
	/** L'alignement se modifie encore : une place peut être libérée. */
	releaseSlot: boolean;
	/** Le joueur était attendu : sa sortie ouvre une demande de remplaçant. */
	requestAbsence: boolean;
	availabilityAudit: AuditEntry;
};

export type AvailabilityWriteResult = {
	/** Demande créée par cette transaction, à notifier après la validation. */
	requestCreated: SubRequestRow | null;
	bumpedPlayerId: string | null;
	/** Demande annulée par le retour du joueur, à notifier après la validation. */
	bumpedRequest: SubRequestRow | null;
};

/**
 * La réponse de présence est une seule transaction : présence, libération de
 * place, demande d'absence ou retour du joueur, et toutes leurs traces. Un
 * échec ne laisse jamais une présence sans sa demande ni son audit; un nouvel
 * essai repart de l'état réellement validé.
 */
export function writeAvailability(
	input: AvailabilityWriteInput
): AvailabilityWriteResult {
	return db.transaction((tx) => {
		upsertAvailability(input.game.id, input.playerId, input.status, input.at, tx);

		let requestCreated: SubRequestRow | null = null;
		let bumpedPlayerId: string | null = null;
		let bumpedRequest: SubRequestRow | null = null;

		if (input.status === 'absent') {
			if (input.releaseSlot) {
				releasePlayerSlot(
					input.game.id,
					input.playerId,
					input.at,
					auditEntry(input.actor, {
						action: 'game.lineup_release',
						entityType: 'game',
						entityId: input.game.id,
						metadata: { playerId: input.playerId, reason: 'absence' }
					}),
					tx
				);
			}
			if (input.requestAbsence) {
				const write = createAbsenceRequestIn(
					tx,
					input.actor,
					input.game,
					{
						userId: input.playerId,
						position: input.position,
						isSubstitute: false
					},
					input.at
				);
				if (write?.created) requestCreated = write.request;
			}
		} else {
			const cancelled = cancelRequestForReturnIn(
				tx,
				input.actor,
				input.game,
				input.playerId,
				input.at
			);
			if (cancelled) {
				bumpedRequest = cancelled.request;
				bumpedPlayerId = cancelled.bumpedPlayerId;
				if (bumpedPlayerId && input.releaseSlot) {
					releasePlayerSlot(
						input.game.id,
						bumpedPlayerId,
						input.at,
						auditEntry(input.actor, {
							action: 'game.lineup_release',
							entityType: 'game',
							entityId: input.game.id,
							metadata: { playerId: bumpedPlayerId, reason: 'bumped' }
						}),
						tx
					);
				}
			}
		}

		insertAudit(input.availabilityAudit, tx);
		return { requestCreated, bumpedPlayerId, bumpedRequest };
	});
}
