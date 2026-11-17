import type { GoalKind } from '#config/goal-kinds.ts';
import { otherTeam, type Team } from '#config/teams.ts';

export type GoalEntryOptions = {
	/** L'équipe dont les joueurs peuvent être choisis comme buteur. */
	scorerTeam: Team;
	/** Une aide n'existe jamais sur un but contre son camp. */
	assistsAllowed: boolean;
};

/**
 * Le seul propriétaire du choix offert pour inscrire un but. Un but contre
 * son camp crédite l'autre camp, mais le buteur est un joueur de l'équipe
 * créditée; il n'y a jamais d'aide. Le service applique la même règle.
 */
export function goalEntryOptions(
	creditedTeam: Team,
	kind: GoalKind
): GoalEntryOptions {
	return kind === 'own_goal'
		? { scorerTeam: otherTeam(creditedTeam), assistsAllowed: false }
		: { scorerTeam: creditedTeam, assistsAllowed: true };
}
