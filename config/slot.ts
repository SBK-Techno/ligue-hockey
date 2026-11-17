import type { Position } from './positions.ts';
import type { Team } from './teams.ts';

/**
 * Une place d'alignement. Ce module n'importe que des types : il reste dans le
 * bundle client sans y tirer zod ni le registre des réglages.
 */
export type SlotIdentity = {
	team: Team;
	position: Position;
	slotIndex: number;
};

/** La clé stable d'une place, la même pour le serveur, la carte et les scripts. */
export function slotKey(slot: SlotIdentity): string {
	return `${slot.team}:${slot.position}:${slot.slotIndex}`;
}

/** L'identifiant de la ligne `game_slots` : le match préfixe la place. */
export function slotRowId(gameId: string, slot: SlotIdentity): string {
	return `${gameId}:${slotKey(slot)}`;
}

export type CandidateAssignment = SlotIdentity & { playerId: string };

/**
 * La clé stable d'un alignement complet, partagée par le générateur et
 * l'instantané. Les places sont triées pour que deux ensembles identiques
 * produisent la même clé quel que soit leur ordre d'arrivée.
 */
export function candidateKey(
	assignments: readonly CandidateAssignment[]
): string {
	return [...assignments]
		.sort(
			(a, b) =>
				a.team.localeCompare(b.team) ||
				a.position.localeCompare(b.position) ||
				a.slotIndex - b.slotIndex
		)
		.map((assignment) => `${slotKey(assignment)}:${assignment.playerId}`)
		.join('|');
}
