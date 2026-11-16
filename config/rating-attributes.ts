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
