import { findPlayersByIds, listActivePlayers } from './queries.ts';
import { toPublic } from './public.ts';
import type { PublicPlayer } from './service.ts';

export type PlayerCandidate = PublicPlayer & {
	age: number;
};

/**
 * Entrées du générateur d'équipes. Ce module ne dépend d'aucun service pour
 * que les services de joueurs, de notes et de règles puissent déclencher un
 * recalcul sans créer de cycle d'importation.
 */
export function generationCandidates(): PlayerCandidate[] {
	return listActivePlayers().map((row) => ({
		...toPublic(row),
		age: row.age
	}));
}

export function playersByIds(playerIds: readonly string[]): PublicPlayer[] {
	return findPlayersByIds(playerIds).map(toPublic);
}
