import type { Position } from './positions.ts';
import type { I18nKey } from './i18n/fr.ts';

/**
 * La fiche de saison garde les quatre notes historiques de la ligue. Elles
 * servent à équilibrer les équipes et restent la seule base du calcul global.
 */
export const RATING_SCALE = {
  min: 1,
  max: 5,
  step: 1
} as const;

export const RATING_ATTRIBUTES = [
  { key: 'passing', labelKey: 'rating.passing' },
  { key: 'speed', labelKey: 'rating.speed' },
  { key: 'agility', labelKey: 'rating.agility' },
  { key: 'backchecking', labelKey: 'rating.backchecking' }
] as const;

export type RatingAttribute = (typeof RATING_ATTRIBUTES)[number]['key'];

export const RATING_ATTRIBUTE_KEYS = RATING_ATTRIBUTES.map(
  (attribute) => attribute.key
) as [RatingAttribute, ...RatingAttribute[]];

export type RatingValues = Partial<Record<RatingAttribute, number>>;

export const RATING_COMPLETE_VALUES: Record<RatingAttribute, number> = {
  passing: 3,
  speed: 3,
  agility: 3,
  backchecking: 3
};

/**
 * Les critères de position complètent la fiche sans changer l'équilibre des
 * équipes. Un joueur peut donc être évalué sur son poste sans bloquer la
 * formation des trios.
 */
export const POSITION_RATING_ATTRIBUTES = {
  forward: [
    {
      key: 'forecheck',
      labelKey: 'rating.forecheck',
      helpKey: 'rating.forecheckHelp'
    },
    {
      key: 'netFront',
      labelKey: 'rating.netFront',
      helpKey: 'rating.netFrontHelp'
    },
    {
      key: 'wallPlay',
      labelKey: 'rating.wallPlay',
      helpKey: 'rating.wallPlayHelp'
    }
  ],
  defense: [
    {
      key: 'gapControl',
      labelKey: 'rating.gapControl',
      helpKey: 'rating.gapControlHelp'
    },
    {
      key: 'firstPass',
      labelKey: 'rating.firstPass',
      helpKey: 'rating.firstPassHelp'
    },
    {
      key: 'netFrontDefence',
      labelKey: 'rating.netFrontDefence',
      helpKey: 'rating.netFrontDefenceHelp'
    }
  ],
  goalie: [
    {
      key: 'goaliePositioning',
      labelKey: 'rating.goaliePositioning',
      helpKey: 'rating.goaliePositioningHelp'
    },
    {
      key: 'reboundControl',
      labelKey: 'rating.reboundControl',
      helpKey: 'rating.reboundControlHelp'
    },
    {
      key: 'hands',
      labelKey: 'rating.hands',
      helpKey: 'rating.handsHelp'
    },
    {
      key: 'puckHandling',
      labelKey: 'rating.puckHandling',
      helpKey: 'rating.puckHandlingHelp'
    },
    {
      key: 'recovery',
      labelKey: 'rating.recovery',
      helpKey: 'rating.recoveryHelp'
    },
    {
      key: 'tracking',
      labelKey: 'rating.tracking',
      helpKey: 'rating.trackingHelp'
    }
  ]
} as const satisfies Record<
  Position,
  readonly { key: string; labelKey: I18nKey; helpKey: I18nKey }[]
>;

export type PositionRatingAttribute =
  (typeof POSITION_RATING_ATTRIBUTES)[Position][number]['key'];

export const POSITION_RATING_KEYS = Object.values(
  POSITION_RATING_ATTRIBUTES
).flatMap((attributes) => attributes.map((attribute) => attribute.key));

export type PositionRatingValues = Partial<Record<string, number>>;

/**
 * Une évaluation de match mesure l'état du joueur ce soir-là, jamais sa
 * valeur de saison. Les deux séries ne se moyennent pas ensemble.
 */
const SKATER_GAME_ATTRIBUTES = [
  {
    key: 'impact',
    labelKey: 'rating.impact',
    helpKey: 'rating.impactHelp'
  },
  {
    key: 'effort',
    labelKey: 'rating.effort',
    helpKey: 'rating.effortHelp'
  },
  {
    key: 'decisions',
    labelKey: 'rating.decisions',
    helpKey: 'rating.decisionsHelp'
  },
  {
    key: 'discipline',
    labelKey: 'rating.discipline',
    helpKey: 'rating.disciplineHelp'
  }
] as const;

const GOALIE_GAME_ATTRIBUTES = [
  {
    key: 'goaliePositioning',
    labelKey: 'rating.goaliePositioning',
    helpKey: 'rating.goaliePositioningHelp'
  },
  {
    key: 'reboundControl',
    labelKey: 'rating.reboundControl',
    helpKey: 'rating.reboundControlHelp'
  },
  {
    key: 'puckHandling',
    labelKey: 'rating.puckHandling',
    helpKey: 'rating.puckHandlingHelp'
  },
  {
    key: 'composure',
    labelKey: 'rating.composure',
    helpKey: 'rating.composureHelp'
  }
] as const;

/**
 * Quatre gestes par match, adaptés au poste. Le gardien est jugé sur son
 * travail devant le filet, pas sur les critères d'un attaquant.
 */
export const GAME_RATING_ATTRIBUTES_BY_POSITION = {
  forward: SKATER_GAME_ATTRIBUTES,
  defense: SKATER_GAME_ATTRIBUTES,
  goalie: GOALIE_GAME_ATTRIBUTES
} as const satisfies Record<
  Position,
  readonly { key: string; labelKey: I18nKey; helpKey: I18nKey }[]
>;

export type GameRatingAttribute =
  | (typeof SKATER_GAME_ATTRIBUTES)[number]['key']
  | (typeof GOALIE_GAME_ATTRIBUTES)[number]['key'];

const GAME_KEYS = [
  ...SKATER_GAME_ATTRIBUTES.map((attribute) => attribute.key),
  ...GOALIE_GAME_ATTRIBUTES.map((attribute) => attribute.key)
] as [GameRatingAttribute, ...GameRatingAttribute[]];

export const GAME_RATING_KEYS = GAME_KEYS;

export type GameRatingValues = Partial<Record<GameRatingAttribute, number>>;

export function overallRating(values: RatingValues): number {
  const total = RATING_ATTRIBUTES.reduce((sum, attribute) => {
    const value = values[attribute.key];
    if (value === undefined) {
      throw new Error(`Missing rating: ${attribute.key}`);
    }
    return sum + value;
  }, 0);

  return total / RATING_ATTRIBUTES.length;
}

export function meanRating(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function isRatingValue(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= RATING_SCALE.min &&
    value <= RATING_SCALE.max
  );
}

export function ratingAttributeDefinition(attribute: RatingAttribute) {
  const definition = RATING_ATTRIBUTES.find((entry) => entry.key === attribute);
  if (!definition) {
    throw new Error(`Unknown rating attribute: ${attribute}`);
  }
  return definition;
}

export function positionRatingAttributes(position: Position) {
  return POSITION_RATING_ATTRIBUTES[position];
}

export function isPositionRatingAttribute(
  position: Position,
  attribute: string
): boolean {
  return POSITION_RATING_ATTRIBUTES[position].some(
    (entry) => entry.key === attribute
  );
}

export function gameRatingAttributes(position: Position) {
  return GAME_RATING_ATTRIBUTES_BY_POSITION[position];
}

export function isGameRatingAttribute(
  position: Position,
  attribute: string
): boolean {
  return GAME_RATING_ATTRIBUTES_BY_POSITION[position].some(
    (entry) => entry.key === attribute
  );
}
