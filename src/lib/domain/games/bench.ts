import type { Position } from '#config/positions.ts';
import { benchPerTeam, type RosterTemplate } from '#config/roster.ts';
import { TEAMS, type Team } from '#config/teams.ts';
import type { BenchPlayer } from './selection.ts';

/** Un membre candidat au banc, avec de quoi équilibrer les effectifs. */
export type DraftMember = {
	playerId: string;
	position: Position;
	kind: 'regular' | 'sub';
	age: number;
	overall: number | null;
};

export type IceDraftPlacement = DraftMember & { team: Team };

type TeamTotal = { count: number; skill: number; age: number };

function average(total: TeamTotal): number {
	return total.count === 0 ? 0 : total.skill / total.count;
}

/**
 * Drafte le banc de chaque équipe après la formation sur la glace. Les
 * membres restants rejoignent l'effectif habillé jusqu'à `rosterSize` par
 * équipe, en servant d'abord l'équipe la plus petite puis la moins forte,
 * pour que les effectifs complets restent équilibrés. Au-delà de la capacité
 * des deux bancs, le joueur attend hors effectif (banc global, sans équipe).
 * Sans banc configuré, tout le monde reste hors effectif : le comportement
 * d'avant.
 */
export function draftTeamBench(
	template: RosterTemplate,
	ice: readonly IceDraftPlacement[],
	remaining: readonly DraftMember[]
): BenchPlayer[] {
	const capacity = benchPerTeam(template);
	const asOverflow = (member: DraftMember): BenchPlayer => ({
		playerId: member.playerId,
		position: member.position,
		kind: member.kind
	});
	// Sans banc configuré, personne n'habille le banc : tout attend hors
	// effectif, exactement comme avant l'effectif par équipe.
	if (capacity === 0) return remaining.map(asOverflow);

	const totals = Object.fromEntries(
		TEAMS.map((team) => [team.key, { count: 0, skill: 0, age: 0 }])
	) as Record<Team, TeamTotal>;
	const benchCount = Object.fromEntries(TEAMS.map((team) => [team.key, 0])) as Record<
		Team,
		number
	>;

	for (const placement of ice) {
		const total = totals[placement.team];
		total.count += 1;
		total.skill += placement.overall ?? 0;
		total.age += placement.age;
	}

	const ordered = [...remaining].sort((a, b) => {
		const skillA = a.overall ?? Number.NEGATIVE_INFINITY;
		const skillB = b.overall ?? Number.NEGATIVE_INFINITY;
		return skillB - skillA || a.playerId.localeCompare(b.playerId);
	});

	const drafted: BenchPlayer[] = [];
	const overflow: BenchPlayer[] = [];

	for (const member of ordered) {
		const eligible = TEAMS.map((team) => team.key).filter(
			(team) => benchCount[team] < capacity
		);
		if (eligible.length === 0) {
			overflow.push(asOverflow(member));
			continue;
		}
		eligible.sort(
			(a, b) =>
				totals[a].count - totals[b].count ||
				average(totals[a]) - average(totals[b]) ||
				totals[a].age - totals[b].age ||
				a.localeCompare(b)
		);
		const team = eligible[0];
		totals[team].count += 1;
		totals[team].skill += member.overall ?? 0;
		totals[team].age += member.age;
		benchCount[team] += 1;
		drafted.push({
			playerId: member.playerId,
			position: member.position,
			kind: member.kind,
			team
		});
	}

	return [...drafted, ...overflow];
}
