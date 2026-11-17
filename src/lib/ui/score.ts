import { teamDefinition, type Team } from '#config/teams.ts';
import { t } from '#lib/shared/i18n/index.ts';

/** Le score d'un match, tel que la feuille de match le calcule. */
export type GameScore = Record<Team, number>;

/**
 * La seule ligne de score de l'application : l'agenda de l'accueil et les
 * rangées de matchs passés affichent exactement le même texte.
 */
export function scoreLine(score: GameScore): string {
	return `${t(teamDefinition('white').shortLabelKey)} ${score.white} · ${t(
		teamDefinition('black').shortLabelKey
	)} ${score.black}`;
}
