import type { I18nKey } from './i18n/fr.ts';

/** Les cinq façons d'inscrire un but, avec leur libellé de feuille. */
export const GOAL_KINDS = [
  { key: 'even', labelKey: 'gamesheet.kind.even' },
  { key: 'power_play', labelKey: 'gamesheet.kind.powerPlay' },
  { key: 'short_handed', labelKey: 'gamesheet.kind.shortHanded' },
  { key: 'penalty_shot', labelKey: 'gamesheet.kind.penaltyShot' },
  { key: 'own_goal', labelKey: 'gamesheet.kind.ownGoal' }
] as const satisfies readonly { key: string; labelKey: I18nKey }[];

export type GoalKind = (typeof GOAL_KINDS)[number]['key'];

export const GOAL_KIND_KEYS = GOAL_KINDS.map((kind) => kind.key) as [
  GoalKind,
  ...GoalKind[]
];

export function goalKindDefinition(kind: GoalKind) {
  const definition = GOAL_KINDS.find((entry) => entry.key === kind);
  if (!definition) {
    throw new Error(`Unknown goal kind: ${kind}`);
  }
  return definition;
}
