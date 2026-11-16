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

export function positionDefinition(position: Position) {
  const definition = POSITIONS.find((entry) => entry.key === position);
  if (!definition) {
    throw new Error(`Unknown position: ${position}`);
  }
  return definition;
}
