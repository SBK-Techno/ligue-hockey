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

/**
 * Les identifiants dont la fiche a été supprimée. Une feuille garde leurs
 * faits, jamais leur identité : l'appelant remplace l'identifiant par le vide
 * et ne peut donc pas ouvrir leur fiche.
 */
export function deletedPlayerIds(playerIds: readonly string[]): Set<string> {
	return new Set(
		findPlayersByIds(playerIds)
			.filter((row) => row.deletedAt !== null)
			.map((row) => row.userId)
	);
}

export function playerCandidatesByIds(
	playerIds: readonly string[]
): PlayerCandidate[] {
	return findPlayersByIds(playerIds).map((row) => ({
		...toPublic(row),
		age: row.age
	}));
}
