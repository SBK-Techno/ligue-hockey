import { describe, expect, it } from 'vitest';
import {
	AVATARS,
	AVATAR_IDS,
	avatarById,
	DEFAULT_AVATAR_ID,
	isAvatarId
} from '#config/avatars.ts';
import { avatarColor, firstFreeAvatarId, resolveAvatarId } from './identity.ts';

describe('catalogue des avatars', () => {
	it('offre 28 identifiants et 28 couleurs uniques', () => {
		expect(AVATARS).toHaveLength(28);
		expect(AVATAR_IDS).toHaveLength(28);
		expect(new Set(AVATAR_IDS).size).toBe(28);
		expect(AVATARS.map((avatar) => avatar.color).sort((a, b) => a - b)).toEqual(
			Array.from({ length: 28 }, (_, index) => index + 1)
		);
		expect(AVATAR_IDS).toContain(DEFAULT_AVATAR_ID);
	});

	it('indexe chaque variante par son identifiant', () => {
		for (const avatar of AVATARS) {
			expect(avatarById[avatar.id]).toBe(avatar);
		}
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

describe('résolution de l’avatar', () => {
	it('accepte chaque identifiant du catalogue', () => {
		for (const avatar of AVATARS) {
			expect(resolveAvatarId('un-joueur', avatar.id)).toBe(avatar.id);
		}
	});

	it('rejette un identifiant absent du catalogue', () => {
		for (const value of ['', 'inconnu', 'Tuque-Rouge', '__proto__']) {
			expect(isAvatarId(value), value).toBe(false);
		}
		expect(isAvatarId(null)).toBe(false);
		expect(isAvatarId(undefined)).toBe(false);
	});

	it('dérive toujours le même avatar pour une fiche sans avatar', () => {
		const first = resolveAvatarId('joueur-stable', null);
		expect(first).toBe(resolveAvatarId('joueur-stable', null));
		expect(first).toBe(resolveAvatarId('joueur-stable', undefined));
		expect(first).toBe(resolveAvatarId('joueur-stable', 'identifiant-invalide'));
		expect(AVATAR_IDS).toContain(first);
	});

	it('nomme la propriété de couleur sans jamais écrire de couleur brute', () => {
		for (const avatar of AVATARS) {
			const property = avatarColor(avatar.id);
			expect(property).toBe(`--color-player-${avatar.color}`);
			expect(property).toMatch(/^--color-player-\d+$/);
			expect(property).not.toContain('#');
		}
	});

	it('choisit le premier avatar libre dans l’ordre du catalogue', () => {
		expect(firstFreeAvatarId([])).toBe(AVATAR_IDS[0]);
		expect(firstFreeAvatarId([AVATAR_IDS[0], AVATAR_IDS[1]])).toBe(AVATAR_IDS[2]);
		expect(firstFreeAvatarId(AVATAR_IDS)).toBeNull();
	});
});
