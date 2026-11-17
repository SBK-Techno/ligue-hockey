import { describe, expect, it } from 'vitest';
import {
	AVATARS,
	AVATAR_IDS,
	DEFAULT_AVATAR_ID
} from '#config/avatars.ts';
import {
	IDENTITIES,
	IDENTITY_IDS,
	identityById,
	isIdentityId,
	legendForIdentity
} from '#config/identities.ts';
import {
	LEGENDS,
	LEGEND_IDS,
	isLegendId,
	legendsForPosition
} from '#config/legends.ts';
import { POSITION_KEYS } from '#config/positions.ts';
import { avatarColor, firstFreeAvatarId, resolveAvatarId } from './identity.ts';

describe('catalogue des visages de la ligue', () => {
	it('offre 28 identifiants et 28 couleurs uniques', () => {
		expect(AVATARS).toHaveLength(28);
		expect(AVATAR_IDS).toHaveLength(28);
		expect(new Set(AVATAR_IDS).size).toBe(28);
		expect(AVATARS.map((avatar) => avatar.color).sort((a, b) => a - b)).toEqual(
			Array.from({ length: 28 }, (_, index) => index + 1)
		);
		expect(AVATAR_IDS).toContain(DEFAULT_AVATAR_ID);
	});

	it('garde des identifiants stables en forme de slug', () => {
		for (const avatar of AVATARS) {
			expect(avatar.id, avatar.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
		}
	});

	it('couvre toutes les carnations, chevelures et coiffures', () => {
		expect(new Set(AVATARS.map((avatar) => avatar.skin))).toEqual(
			new Set([1, 2, 3, 4, 5, 6])
		);
		expect(new Set(AVATARS.map((avatar) => avatar.hair))).toEqual(
			new Set([1, 2, 3, 4, 5, 6])
		);
		expect(new Set(AVATARS.map((avatar) => avatar.bg))).toEqual(
			new Set([1, 2, 3, 4, 5, 6])
		);
		expect(new Set(AVATARS.map((avatar) => avatar.style))).toEqual(
			new Set(['short', 'buzz', 'curly', 'long', 'bun', 'bald', 'toque', 'helmet', 'mask'])
		);
	});

	it('réserve exactement quatre masques de gardien', () => {
		expect(AVATARS.filter((avatar) => avatar.style === 'mask')).toHaveLength(4);
	});

	it('varie la pilosité et les lunettes', () => {
		expect(new Set(AVATARS.map((avatar) => avatar.facial))).toEqual(
			new Set(['none', 'stubble', 'moustache', 'beard'])
		);
		expect(AVATARS.some((avatar) => avatar.glasses)).toBe(true);
		expect(AVATARS.some((avatar) => !avatar.glasses)).toBe(true);
	});
});

describe('identités hommage', () => {
	it('offre quinze légendes, cinq par poste', () => {
		expect(LEGENDS).toHaveLength(15);
		expect(LEGEND_IDS).toHaveLength(15);
		expect(new Set(LEGEND_IDS).size).toBe(15);
		for (const position of POSITION_KEYS) {
			expect(legendsForPosition(position), position).toHaveLength(5);
		}
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

	it('réserve quinze couleurs après celles des visages de la ligue', () => {
		expect(LEGENDS.map((legend) => legend.color).sort((a, b) => a - b)).toEqual(
			Array.from({ length: 15 }, (_, index) => index + 29)
		);
	});

	it('reconnaît une légende et distingue un visage de la ligue', () => {
		for (const legend of LEGENDS) {
			expect(isLegendId(legend.id)).toBe(true);
			expect(legendForIdentity(legend.id)?.name).toBe(legend.name);
		}
		expect(isLegendId('capitaine-navy')).toBe(false);
		expect(legendForIdentity('capitaine-navy')).toBeNull();
		expect(legendForIdentity(null)).toBeNull();
	});
});

describe('catalogue des identités', () => {
	it('réunit les deux familles sans doublon', () => {
		expect(IDENTITIES).toHaveLength(43);
		expect(IDENTITY_IDS).toHaveLength(43);
		expect(new Set(IDENTITY_IDS).size).toBe(43);
		expect(IDENTITY_IDS.slice(0, 28)).toEqual(AVATAR_IDS);
		expect(IDENTITY_IDS.slice(28)).toEqual(LEGEND_IDS);
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

	it('nomme la propriété de couleur sans jamais écrire de couleur brute', () => {
		for (const identity of IDENTITIES) {
			const property = avatarColor(identity.id);
			expect(property).toBe(`--color-player-${identity.color}`);
			expect(property).toMatch(/^--color-player-\d+$/);
			expect(property).not.toContain('#');
		}
	});

	it('choisit le premier visage libre, puis la première légende libre', () => {
		expect(firstFreeAvatarId([])).toBe(AVATAR_IDS[0]);
		expect(firstFreeAvatarId([AVATAR_IDS[0], AVATAR_IDS[1]])).toBe(AVATAR_IDS[2]);
		expect(firstFreeAvatarId(AVATAR_IDS)).toBe(LEGEND_IDS[0]);
		expect(firstFreeAvatarId(IDENTITY_IDS)).toBeNull();
	});
});
