import { describe, expect, it } from 'vitest';
import {
	AVATARS,
	AVATAR_IDS,
	DEFAULT_AVATAR_ID
} from '#config/avatars.ts';
import {
	IDENTITIES,
	IDENTITY_IDS,
	identityAllowedForPosition,
	identityById,
	isIdentityId,
	legendForIdentity
} from '#config/identities.ts';
import {
	LEGENDS,
	LEGEND_IDS,
	legendOptionsForPosition,
	legendsForPosition
} from '#config/legends.ts';
import { POSITION_KEYS } from '#config/positions.ts';
import { branding } from '#lib/generated/branding.ts';
import { firstFreeAvatarId } from './identity-assignment.ts';
import { resolveAvatarId } from './identity.ts';

describe('catalogue des visages de la ligue', () => {
	it('offre 28 identifiants uniques', () => {
		expect(AVATARS).toHaveLength(28);
		expect(AVATAR_IDS).toHaveLength(28);
		expect(new Set(AVATAR_IDS).size).toBe(28);
		expect(AVATAR_IDS).toContain(DEFAULT_AVATAR_ID);
	});

	it('garde des identifiants stables en forme de slug', () => {
		for (const avatar of AVATARS) {
			expect(avatar.id, avatar.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
		}
	});
});

describe('identités hommage', () => {
	it('couvre le poste le plus large avec les légendes seules', () => {
		expect(LEGENDS).toHaveLength(38);
		expect(LEGEND_IDS).toHaveLength(38);
		expect(new Set(LEGEND_IDS).size).toBe(38);
		// Deux équipes de 8 attaquants, 8 défenseurs et 3 gardiens.
		expect(legendsForPosition('forward')).toHaveLength(16);
		expect(legendsForPosition('defense')).toHaveLength(16);
		expect(legendsForPosition('goalie')).toHaveLength(6);
	});

	it('donne un numéro et une époque crédibles à chaque légende', () => {
		for (const legend of LEGENDS) {
			expect(legend.name.trim().length, legend.id).toBeGreaterThan(1);
			expect(legend.number, legend.id).toBeGreaterThanOrEqual(1);
			expect(legend.number, legend.id).toBeLessThanOrEqual(99);
			expect(legend.era, legend.id).toMatch(/^\d{4}-\d{4}$/);
			expect(POSITION_KEYS, legend.id).toContain(legend.position);
		}
	});

	it('conserve les faits vérifiés de chaque légende', () => {
		// Table de vérité revue contre Hockey-Reference et les registres de
		// chandails du Canadien. Une légende déplacée, renumérotée ou dont
		// l'époque change doit casser ce test, pas passer inaperçue.
		const expected: ReadonlyArray<
			readonly [string, string, number, string, string]
		> = [
			['legende-plante', 'Jacques Plante', 1, 'goalie', '1952-1963'],
			['legende-dryden', 'Ken Dryden', 29, 'goalie', '1970-1979'],
			['legende-roy', 'Patrick Roy', 33, 'goalie', '1984-1996'],
			['legende-price', 'Carey Price', 31, 'goalie', '2007-2022'],
			['legende-vezina', 'Georges Vézina', 1, 'goalie', '1910-1925'],
			['legende-durnan', 'Bill Durnan', 1, 'goalie', '1943-1950'],
			['legende-harvey', 'Doug Harvey', 2, 'defense', '1947-1961'],
			['legende-savard', 'Serge Savard', 18, 'defense', '1966-1981'],
			['legende-robinson', 'Larry Robinson', 19, 'defense', '1972-1989'],
			['legende-lapointe', 'Guy Lapointe', 5, 'defense', '1968-1982'],
			['legende-markov', 'Andrei Markov', 79, 'defense', '2000-2017'],
			['legende-laperriere', 'Jacques Laperrière', 2, 'defense', '1962-1974'],
			['legende-bouchard', 'Émile Bouchard', 3, 'defense', '1941-1956'],
			['legende-chelios', 'Chris Chelios', 24, 'defense', '1983-1990'],
			['legende-subban', 'P.K. Subban', 76, 'defense', '2009-2016'],
			['legende-weber', 'Shea Weber', 6, 'defense', '2016-2021'],
			['legende-tremblay', 'J.C. Tremblay', 3, 'defense', '1959-1972'],
			['legende-johnson', 'Tom Johnson', 10, 'defense', '1947-1963'],
			['legende-talbot', 'Jean-Guy Talbot', 17, 'defense', '1954-1967'],
			['legende-langway', 'Rod Langway', 17, 'defense', '1978-1982'],
			['legende-ludwig', 'Craig Ludwig', 17, 'defense', '1982-1990'],
			['legende-brisebois', 'Patrice Brisebois', 43, 'defense', '1991-2009'],
			['legende-maurice-richard', 'Maurice Richard', 9, 'forward', '1942-1960'],
			['legende-beliveau', 'Jean Béliveau', 4, 'forward', '1950-1971'],
			['legende-lafleur', 'Guy Lafleur', 10, 'forward', '1971-1985'],
			['legende-henri-richard', 'Henri Richard', 16, 'forward', '1955-1975'],
			['legende-koivu', 'Saku Koivu', 11, 'forward', '1995-2009'],
			['legende-gainey', 'Bob Gainey', 23, 'forward', '1973-1989'],
			['legende-cournoyer', 'Yvan Cournoyer', 12, 'forward', '1963-1979'],
			['legende-moore', 'Dickie Moore', 12, 'forward', '1951-1963'],
			['legende-geoffrion', 'Bernie Geoffrion', 5, 'forward', '1950-1964'],
			['legende-blake', 'Toe Blake', 6, 'forward', '1935-1948'],
			['legende-lach', 'Elmer Lach', 16, 'forward', '1940-1954'],
			['legende-lemaire', 'Jacques Lemaire', 25, 'forward', '1967-1979'],
			['legende-shutt', 'Steve Shutt', 22, 'forward', '1972-1985'],
			['legende-damphousse', 'Vincent Damphousse', 25, 'forward', '1992-1999'],
			['legende-carbonneau', 'Guy Carbonneau', 21, 'forward', '1980-1994'],
			['legende-morenz', 'Howie Morenz', 7, 'forward', '1923-1937']
		];

		const actual = LEGENDS.map((legend) => [
			legend.id,
			legend.name,
			legend.number,
			legend.position,
			legend.era
		]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
		expect(actual).toEqual(
			[...expected].sort((a, b) => a[0].localeCompare(b[0]))
		);
	});

	it('garde des identifiants stables en forme de slug', () => {
		for (const legend of LEGENDS) {
			expect(legend.id, legend.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
		}
	});

	it('reconnaît une légende et distingue un visage de la ligue', () => {
		for (const legend of LEGENDS) {
			expect(legendForIdentity(legend.id)?.name).toBe(legend.name);
		}
		expect(legendForIdentity('capitaine-navy')).toBeNull();
		expect(legendForIdentity(null)).toBeNull();
	});
});

describe('catalogue des identités', () => {
	it('réunit les deux familles sans doublon', () => {
		expect(IDENTITIES).toHaveLength(66);
		expect(IDENTITY_IDS).toHaveLength(66);
		expect(new Set(IDENTITY_IDS).size).toBe(66);
		expect(IDENTITY_IDS.slice(0, AVATAR_IDS.length)).toEqual(AVATAR_IDS);
		expect(IDENTITY_IDS.slice(AVATAR_IDS.length)).toEqual(LEGEND_IDS);
	});

	it('indexe chaque identité par son identifiant', () => {
		for (const identity of IDENTITIES) {
			expect(identityById[identity.id]).toBe(identity);
			expect(isIdentityId(identity.id)).toBe(true);
		}
	});

	it('refuse un identifiant absent du catalogue', () => {
		for (const value of ['', 'inconnu', 'Legende-roy', '__proto__']) {
			expect(isIdentityId(value), value).toBe(false);
		}
		expect(isIdentityId(null)).toBe(false);
		expect(isIdentityId(undefined)).toBe(false);
	});

	it('génère l’index compact depuis le catalogue complet', () => {
		expect(branding.identities.ids).toEqual([...IDENTITY_IDS]);
		expect(branding.identities.leagueFaces).toBe(AVATAR_IDS.length);
	});
});

describe('résolution de l’identité', () => {
	it('accepte chaque identifiant du catalogue', () => {
		for (const identity of IDENTITIES) {
			expect(resolveAvatarId('un-joueur', identity.id)).toBe(identity.id);
		}
	});

	it('dérive toujours le même visage de la ligue pour une fiche sans identité', () => {
		const first = resolveAvatarId('joueur-stable', null);
		expect(first).toBe(resolveAvatarId('joueur-stable', null));
		expect(first).toBe(resolveAvatarId('joueur-stable', undefined));
		expect(first).toBe(resolveAvatarId('joueur-stable', 'identifiant-invalide'));
		expect(AVATAR_IDS).toContain(first);
	});

	it('choisit la première légende libre, puis le premier visage libre', () => {
		expect(firstFreeAvatarId([])).toBe(LEGEND_IDS[0]);
		expect(firstFreeAvatarId([LEGEND_IDS[0], LEGEND_IDS[1]])).toBe(LEGEND_IDS[2]);
		expect(firstFreeAvatarId(LEGEND_IDS)).toBe(AVATAR_IDS[0]);
		expect(firstFreeAvatarId(IDENTITY_IDS)).toBeNull();
	});

	it('ne donne jamais une légende d’un autre poste', () => {
		for (const position of POSITION_KEYS) {
			const assigned = firstFreeAvatarId([], position);
			expect(assigned, position).not.toBeNull();
			expect(identityAllowedForPosition(assigned!, position), position).toBe(true);
		}
		expect(firstFreeAvatarId([], 'forward')).toBe('legende-maurice-richard');
		expect(firstFreeAvatarId(IDENTITY_IDS, 'forward')).toBeNull();
	});
});

describe('position des identités', () => {
	it('accepte chaque visage de la ligue à tous les postes', () => {
		for (const avatarId of AVATAR_IDS) {
			for (const position of POSITION_KEYS) {
				expect(identityAllowedForPosition(avatarId, position), avatarId).toBe(true);
			}
		}
	});

	it('réserve chaque légende à son poste', () => {
		for (const legend of LEGENDS) {
			for (const position of POSITION_KEYS) {
				expect(
					identityAllowedForPosition(legend.id, position),
					`${legend.id}:${position}`
				).toBe(legend.position === position);
			}
		}
		expect(identityAllowedForPosition('legende-lafleur', 'goalie')).toBe(false);
		expect(identityAllowedForPosition('legende-plante', 'goalie')).toBe(true);
	});
});

describe('options de légendes du sélecteur', () => {
	it('suit l’ordre déclaré du catalogue, par première saison, à chaque poste', () => {
		for (const position of POSITION_KEYS) {
			const starts = legendOptionsForPosition(position, null).map((legend) =>
				Number(legend.era.slice(0, 4))
			);
			expect(starts, position).toEqual([...starts].sort((a, b) => a - b));
		}
	});

	it('garde la légende enregistrée hors poste en tête, une seule fois', () => {
		const options = legendOptionsForPosition('forward', 'legende-roy');

		expect(options[0].id).toBe('legende-roy');
		expect(options[0].position).toBe('goalie');
		expect(options.filter((legend) => legend.id === 'legende-roy')).toHaveLength(1);
		expect(options).toHaveLength(legendsForPosition('forward').length + 1);
	});

	it('ne duplique pas une légende déjà offerte au poste courant', () => {
		const options = legendOptionsForPosition('goalie', 'legende-roy');

		expect(options.filter((legend) => legend.id === 'legende-roy')).toHaveLength(1);
		expect(options).toHaveLength(legendsForPosition('goalie').length);
	});

	it('liste seulement le poste quand rien n’est enregistré', () => {
		expect(legendOptionsForPosition('defense', null)).toEqual(
			legendsForPosition('defense')
		);
	});
});
