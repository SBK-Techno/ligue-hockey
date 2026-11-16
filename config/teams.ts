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
