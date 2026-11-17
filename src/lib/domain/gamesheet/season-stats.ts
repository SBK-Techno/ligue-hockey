import { playerSeasonStats, type PlayerSeasonStats } from './queries.ts';

/**
 * Les totaux d'une saison, dérivés une seule fois. Le profil et la fiche
 * partagée lisent ce même objet : ils ne peuvent pas afficher deux totaux
 * différents pour la même personne.
 */
export type SeasonStats = PlayerSeasonStats & {
	points: number;
	pointsPerGame: number;
};

export function deriveSeasonStats(totals: PlayerSeasonStats): SeasonStats {
	const points = totals.goals + totals.assists;
	return {
		...totals,
		points,
		pointsPerGame: totals.games === 0 ? 0 : points / totals.games
	};
}

export function seasonStatsFor(playerId: string): SeasonStats {
	return deriveSeasonStats(playerSeasonStats(playerId));
}
