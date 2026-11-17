export const TEAMS = [
  {
    key: 'white',
    labelKey: 'team.white',
    shortLabelKey: 'team.white.short',
    tone: 'white'
  },
  {
    key: 'black',
    labelKey: 'team.black',
    shortLabelKey: 'team.black.short',
    tone: 'black'
  }
] as const;

export type Team = (typeof TEAMS)[number]['key'];

export const TEAM_KEYS = TEAMS.map((team) => team.key) as [Team, ...Team[]];

/** L'autre camp, sans jamais dépendre de l'ordre du registre. */
export function otherTeam(team: Team): Team {
  return team === 'white' ? 'black' : 'white';
}

/** L'équipe du joueur d'abord, puis l'ordre déclaré du registre. */
export function orderedTeams(ownTeam: Team | null): readonly (typeof TEAMS)[number][] {
  if (!ownTeam) return TEAMS;
  return [...TEAMS].sort((a, b) =>
    a.key === ownTeam ? -1 : b.key === ownTeam ? 1 : 0
  );
}

export function teamDefinition(team: Team) {
  const definition = TEAMS.find((entry) => entry.key === team);
  if (!definition) {
    throw new Error(`Unknown team: ${team}`);
  }
  return definition;
}

export const TEAM_GENERATION = {
	maxCandidates: 200_000
} as const;

/** Bornes d'affichage de la section Équipes, jamais des règles de jeu. */
export const TEAM_SECTION = {
	historyLimit: 20
} as const;
