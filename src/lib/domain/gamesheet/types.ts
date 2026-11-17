import type { Team } from '#config/teams.ts';
import type { InfractionKey } from '#config/infractions.ts';
import type { GoalKind } from './schema.ts';

/**
 * Référence figée d'un joueur au moment de l'écriture. Le nom et le numéro
 * viennent de la feuille de match, pas de la fiche vivante : changer un
 * chandail ne réécrit pas un but déjà inscrit. Un identifiant vide signifie
 * que le compte a été supprimé et que seule l'identité figée subsiste.
 */
export type GamePlayerRef = {
	playerId: string;
	fullName: string;
	jerseyNumber: number | null;
	team: Team;
};

export type GameGoalView = {
	id: string;
	team: Team;
	period: number;
	clock: string;
	kind: GoalKind;
	scorer: GamePlayerRef | null;
	assists: GamePlayerRef[];
	ownGoal: boolean;
	penaltyShot: boolean;
};

export type GamePenaltyView = {
	id: string;
	team: Team;
	period: number;
	clock: string;
	player: GamePlayerRef;
	infraction: InfractionKey;
	minutes: number;
	coincidental: boolean;
};

export type PlayerTotals = {
	playerId: string;
	fullName: string;
	jerseyNumber: number | null;
	team: Team;
	goals: number;
	assists: number;
	points: number;
	penaltyMinutes: number;
};

export type GameSheetView = {
	gameId: string;
	goals: GameGoalView[];
	penalties: GamePenaltyView[];
	score: Record<Team, number>;
	totals: PlayerTotals[];
	finalized: boolean;
};
