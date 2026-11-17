import type { Position } from './positions.ts';

/**
 * Tribute identities.
 *
 * The names, jersey numbers, positions and eras are historical facts about
 * Montréal Canadiens alumni. The portraits are original painted images,
 * recognizable through likeness, era and equipment: no photograph, logo or
 * official mark is used or implied. The disclaimer shown by the picker is the
 * single notice for the whole family.
 *
 * A legend is a complete identity: its facts and its painted portrait belong
 * to the catalogue, and the picker only offers the legends that played the
 * player's position.
 *
 * Selection: thirty of the most popular alumni, distributed 15 forwards,
 * 11 defense and 4 goalies to mirror the league roster (14/10/4). The era is
 * the season span, first season start year to last season end year, so Roy is
 * 1984-1996 and Dryden is 1970-1979. Morenz is preferred to Näslund and
 * Tremblay to Brisebois because the retired-number core outranks longevity.
 * Duplicate jersey numbers are historical: 2, 3, 5, 6, 12, 16 and 25 were each
 * worn by two of these players.
 */
type LegendShape = {
  id: string;
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
    era: '1952-1963'
  },
  {
    id: 'legende-dryden',
    name: 'Ken Dryden',
    number: 29,
    position: 'goalie',
    era: '1970-1979'
  },
  {
    id: 'legende-roy',
    name: 'Patrick Roy',
    number: 33,
    position: 'goalie',
    era: '1984-1996'
  },
  {
    id: 'legende-price',
    name: 'Carey Price',
    number: 31,
    position: 'goalie',
    era: '2007-2022'
  },
  {
    id: 'legende-harvey',
    name: 'Doug Harvey',
    number: 2,
    position: 'defense',
    era: '1947-1961'
  },
  {
    id: 'legende-savard',
    name: 'Serge Savard',
    number: 18,
    position: 'defense',
    era: '1966-1981'
  },
  {
    id: 'legende-robinson',
    name: 'Larry Robinson',
    number: 19,
    position: 'defense',
    era: '1972-1989'
  },
  {
    id: 'legende-lapointe',
    name: 'Guy Lapointe',
    number: 5,
    position: 'defense',
    era: '1968-1982'
  },
  {
    id: 'legende-markov',
    name: 'Andrei Markov',
    number: 79,
    position: 'defense',
    era: '2000-2017'
  },
  {
    id: 'legende-maurice-richard',
    name: 'Maurice Richard',
    number: 9,
    position: 'forward',
    era: '1942-1960'
  },
  {
    id: 'legende-beliveau',
    name: 'Jean Béliveau',
    number: 4,
    position: 'forward',
    era: '1950-1971'
  },
  {
    id: 'legende-lafleur',
    name: 'Guy Lafleur',
    number: 10,
    position: 'forward',
    era: '1971-1985'
  },
  {
    id: 'legende-henri-richard',
    name: 'Henri Richard',
    number: 16,
    position: 'forward',
    era: '1955-1975'
  },
  {
    id: 'legende-koivu',
    name: 'Saku Koivu',
    number: 11,
    position: 'forward',
    era: '1995-2009',
  }
,
  {
    id: 'legende-laperriere',
    name: 'Jacques Laperrière',
    number: 2,
    position: 'defense',
    era: '1962-1974'
  },
  {
    id: 'legende-bouchard',
    name: 'Émile Bouchard',
    number: 3,
    position: 'defense',
    era: '1941-1956'
  },
  {
    id: 'legende-chelios',
    name: 'Chris Chelios',
    number: 24,
    position: 'defense',
    era: '1983-1990'
  },
  {
    id: 'legende-subban',
    name: 'P.K. Subban',
    number: 76,
    position: 'defense',
    era: '2009-2016'
  },
  {
    id: 'legende-weber',
    name: 'Shea Weber',
    number: 6,
    position: 'defense',
    era: '2016-2021'
  },
  {
    id: 'legende-tremblay',
    name: 'J.C. Tremblay',
    number: 3,
    position: 'defense',
    era: '1959-1972'
  },
  {
    id: 'legende-gainey',
    name: 'Bob Gainey',
    number: 23,
    position: 'forward',
    era: '1973-1989'
  },
  {
    id: 'legende-cournoyer',
    name: 'Yvan Cournoyer',
    number: 12,
    position: 'forward',
    era: '1963-1979'
  },
  {
    id: 'legende-moore',
    name: 'Dickie Moore',
    number: 12,
    position: 'forward',
    era: '1951-1963'
  },
  {
    id: 'legende-geoffrion',
    name: 'Bernie Geoffrion',
    number: 5,
    position: 'forward',
    era: '1950-1964'
  },
  {
    id: 'legende-blake',
    name: 'Toe Blake',
    number: 6,
    position: 'forward',
    era: '1935-1948'
  },
  {
    id: 'legende-lach',
    name: 'Elmer Lach',
    number: 16,
    position: 'forward',
    era: '1940-1954'
  },
  {
    id: 'legende-lemaire',
    name: 'Jacques Lemaire',
    number: 25,
    position: 'forward',
    era: '1967-1979'
  },
  {
    id: 'legende-shutt',
    name: 'Steve Shutt',
    number: 22,
    position: 'forward',
    era: '1972-1985'
  },
  {
    id: 'legende-damphousse',
    name: 'Vincent Damphousse',
    number: 25,
    position: 'forward',
    era: '1992-1999'
  },
  {
    id: 'legende-morenz',
    name: 'Howie Morenz',
    number: 7,
    position: 'forward',
    era: '1923-1937',
  }
] as const satisfies readonly LegendShape[];

export type Legend = (typeof LEGENDS)[number];
export type LegendId = Legend['id'];

export const LEGEND_IDS = LEGENDS.map((legend) => legend.id) as [
  LegendId,
  ...LegendId[]
];

/** La première saison d'une ère, l'unique clé d'ordre du catalogue. */
function eraStart(era: string): number {
  return Number(era.slice(0, 4));
}

/**
 * L'ordre du catalogue : la première saison, puis le nom pour départager.
 * Il est déclaré ici et appliqué une seule fois, à la projection du sélecteur.
 */
export function compareLegends(a: Legend, b: Legend): number {
  return eraStart(a.era) - eraStart(b.era) || a.name.localeCompare(b.name, 'fr');
}

/**
 * The tribute list for one position. Callers pass the position currently
 * selected in the form, so changing position immediately changes the list.
 */
export function legendsForPosition(position: Position): readonly Legend[] {
  return LEGENDS.filter((legend) => legend.position === position).sort(compareLegends);
}

/**
 * La liste du sélecteur : les légendes du poste courant, plus la légende
 * déjà enregistrée si elle vient d'un autre poste. Elle reste donc visible et
 * soumise, plutôt que de disparaître sous les pieds du joueur.
 */
export function legendOptionsForPosition(
  position: Position,
  selectedId: string | null
): readonly Legend[] {
  const available = legendsForPosition(position);
  const selected = selectedId
    ? LEGENDS.find((legend) => legend.id === selectedId)
    : undefined;
  if (!selected || available.some((legend) => legend.id === selected.id)) {
    return available;
  }
  return [selected, ...available];
}
