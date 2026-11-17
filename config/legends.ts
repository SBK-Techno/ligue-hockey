import type { AvatarArt } from './avatars.ts';
import type { Position } from './positions.ts';

/**
 * Tribute identities.
 *
 * The names, jersey numbers, positions and eras are historical facts about
 * Montréal Canadiens alumni. The portraits are original stylised vectors built
 * on the same drawing contract as the league avatars: no photograph, no logo
 * and no official mark is used or implied. The disclaimer shown by the picker
 * is the single notice for the whole family.
 *
 * A legend is a complete identity: it owns its appearance and its colour, and
 * the picker only offers the legends that played the player's position.
 */
type LegendShape = AvatarArt & {
  name: string;
  number: number;
  position: Position;
  era: string;
};

export const LEGENDS = [
  {
    id: 'legende-plante',
    name: 'Jacques Plante',
    number: 1,
    position: 'goalie',
    era: '1952-1963',
    color: 29,
    skin: 2,
    hair: 3,
    bg: 1,
    style: 'mask',
    facial: 'none',
    glasses: false,
    mouth: 'flat'
  },
  {
    id: 'legende-dryden',
    name: 'Ken Dryden',
    number: 29,
    position: 'goalie',
    era: '1970-1979',
    color: 30,
    skin: 1,
    hair: 4,
    bg: 5,
    style: 'mask',
    facial: 'none',
    glasses: true,
    mouth: 'smile'
  },
  {
    id: 'legende-roy',
    name: 'Patrick Roy',
    number: 33,
    position: 'goalie',
    era: '1984-1995',
    color: 31,
    skin: 3,
    hair: 2,
    bg: 6,
    style: 'mask',
    facial: 'stubble',
    glasses: false,
    mouth: 'grin'
  },
  {
    id: 'legende-price',
    name: 'Carey Price',
    number: 31,
    position: 'goalie',
    era: '2007-2022',
    color: 32,
    skin: 4,
    hair: 1,
    bg: 2,
    style: 'mask',
    facial: 'beard',
    glasses: false,
    mouth: 'flat'
  },
  {
    id: 'legende-vachon',
    name: 'Rogie Vachon',
    number: 30,
    position: 'goalie',
    era: '1966-1972',
    color: 33,
    skin: 5,
    hair: 5,
    bg: 4,
    style: 'mask',
    facial: 'none',
    glasses: false,
    mouth: 'smile'
  },
  {
    id: 'legende-harvey',
    name: 'Doug Harvey',
    number: 2,
    position: 'defense',
    era: '1947-1961',
    color: 34,
    skin: 6,
    hair: 2,
    bg: 3,
    style: 'short',
    facial: 'none',
    glasses: false,
    mouth: 'flat'
  },
  {
    id: 'legende-savard',
    name: 'Serge Savard',
    number: 18,
    position: 'defense',
    era: '1966-1981',
    color: 35,
    skin: 1,
    hair: 6,
    bg: 1,
    style: 'short',
    facial: 'none',
    glasses: false,
    mouth: 'smile'
  },
  {
    id: 'legende-robinson',
    name: 'Larry Robinson',
    number: 19,
    position: 'defense',
    era: '1972-1989',
    color: 36,
    skin: 5,
    hair: 3,
    bg: 5,
    style: 'short',
    facial: 'stubble',
    glasses: false,
    mouth: 'grin'
  },
  {
    id: 'legende-lapointe',
    name: 'Guy Lapointe',
    number: 5,
    position: 'defense',
    era: '1968-1982',
    color: 37,
    skin: 2,
    hair: 1,
    bg: 6,
    style: 'short',
    facial: 'moustache',
    glasses: false,
    mouth: 'smile'
  },
  {
    id: 'legende-markov',
    name: 'Andrei Markov',
    number: 79,
    position: 'defense',
    era: '2000-2017',
    color: 38,
    skin: 3,
    hair: 4,
    bg: 4,
    style: 'buzz',
    facial: 'stubble',
    glasses: false,
    mouth: 'flat'
  },
  {
    id: 'legende-maurice-richard',
    name: 'Maurice Richard',
    number: 9,
    position: 'forward',
    era: '1942-1960',
    color: 39,
    skin: 2,
    hair: 2,
    bg: 2,
    style: 'short',
    facial: 'none',
    glasses: false,
    mouth: 'flat'
  },
  {
    id: 'legende-beliveau',
    name: 'Jean Béliveau',
    number: 4,
    position: 'forward',
    era: '1950-1971',
    color: 40,
    skin: 1,
    hair: 1,
    bg: 4,
    style: 'short',
    facial: 'none',
    glasses: false,
    mouth: 'smile'
  },
  {
    id: 'legende-lafleur',
    name: 'Guy Lafleur',
    number: 10,
    position: 'forward',
    era: '1971-1985',
    color: 41,
    skin: 3,
    hair: 4,
    bg: 1,
    style: 'long',
    facial: 'none',
    glasses: false,
    mouth: 'grin'
  },
  {
    id: 'legende-henri-richard',
    name: 'Henri Richard',
    number: 16,
    position: 'forward',
    era: '1955-1975',
    color: 42,
    skin: 4,
    hair: 3,
    bg: 3,
    style: 'buzz',
    facial: 'none',
    glasses: false,
    mouth: 'smile'
  },
  {
    id: 'legende-koivu',
    name: 'Saku Koivu',
    number: 11,
    position: 'forward',
    era: '1996-2009',
    color: 43,
    skin: 1,
    hair: 5,
    bg: 5,
    style: 'short',
    facial: 'stubble',
    glasses: false,
    mouth: 'flat'
  }
] as const satisfies readonly LegendShape[];

export type Legend = (typeof LEGENDS)[number];
export type LegendId = Legend['id'];

export const LEGEND_IDS = LEGENDS.map((legend) => legend.id) as [
  LegendId,
  ...LegendId[]
];

export const legendById = Object.fromEntries(
  LEGENDS.map((legend) => [legend.id, legend])
) as Readonly<Record<LegendId, Legend>>;

export function isLegendId(value: string | null | undefined): value is LegendId {
  return typeof value === 'string' && Object.hasOwn(legendById, value);
}

/**
 * The tribute list for one position. Callers pass the position currently
 * selected in the form, so changing position immediately changes the list.
 */
export function legendsForPosition(position: Position): readonly Legend[] {
  return LEGENDS.filter((legend) => legend.position === position);
}
