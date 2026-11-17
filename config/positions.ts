export const POSITIONS = [
  {
    key: 'forward',
    labelKey: 'position.forward',
    shortLabelKey: 'position.forward.short',
    slotLabelKey: 'position.forward.slot',
    skater: true
  },
  {
    key: 'defense',
    labelKey: 'position.defense',
    shortLabelKey: 'position.defense.short',
    slotLabelKey: 'position.defense.slot',
    skater: true
  },
  {
    key: 'goalie',
    labelKey: 'position.goalie',
    shortLabelKey: 'position.goalie.short',
    slotLabelKey: 'position.goalie.slot',
    skater: false
  }
] as const;

export type Position = (typeof POSITIONS)[number]['key'];

export const POSITION_KEYS = POSITIONS.map((position) => position.key) as [
  Position,
  ...Position[]
];

export const SKATER_POSITIONS = POSITIONS.filter((position) => position.skater);

export function isPosition(value: string): value is Position {
  return POSITION_KEYS.includes(value as Position);
}

/**
 * The only slot-eligibility rule: the player's position must be one of the
 * positions the slot accepts. A goalie never replaces a defenceman, even in
 * the lineup editor.
 */
export function canFillPosition(
  playerPositions: readonly Position[],
  slotPosition: Position
): boolean {
  return playerPositions.includes(slotPosition);
}

/**
 * L'ordre des postes pour l'affichage et les comparaisons : attaque, défense,
 * gardien. C'est le seul propriétaire de ce rang.
 */
export function positionRank(position: Position): number {
  return POSITION_KEYS.indexOf(position);
}

/** Le préfixe commun des tris de bassin : poste, puis régulier ou remplaçant. */
export function comparePositionThenKind(
  a: { position: Position; kind: string },
  b: { position: Position; kind: string }
): number {
  return (
    positionRank(a.position) - positionRank(b.position) ||
    a.kind.localeCompare(b.kind)
  );
}

export function positionDefinition(position: Position) {
  const definition = POSITIONS.find((entry) => entry.key === position);
  if (!definition) {
    throw new Error(`Unknown position: ${position}`);
  }
  return definition;
}
