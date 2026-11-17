import { describe, expect, it } from 'vitest';
import { fr, type I18nKey } from '#config/i18n/fr.ts';

/**
 * Le glossaire des remplaçants : une place est le créneau à combler, un poste
 * est la position du joueur. Ces clés sont celles que les surfaces de
 * remplacement affichent; une nouvelle copie doit suivre le même mot.
 */
const SLOT_KEYS: readonly I18nKey[] = [
	'subs.placeOpen',
	'subs.openPositions',
	'subs.claim',
	'subs.claimed',
	'subs.claimTaken',
	'subs.notEligible',
	'subs.noneOpen',
	'subs.declined',
	'notifications.subNeeded.body',
	'notifications.subClaimed.title',
	'notifications.subClaimed.body',
	'notifications.subBumped.title'
];

const POSITION_KEYS: readonly I18nKey[] = [
	'position.label',
	'subs.positions',
	'subs.choosePosition',
	'subs.positionNotSelected',
	'subs.profileSaved'
];

describe('glossaire des remplaçants', () => {
	it('appelle une place la place à combler', () => {
		for (const key of SLOT_KEYS) {
			expect(fr[key], key).toMatch(/\bplace/i);
			expect(fr[key], key).not.toMatch(/\bposte/i);
		}
	});

	it('appelle un poste la position du joueur', () => {
		for (const key of POSITION_KEYS) {
			expect(fr[key], key).toMatch(/\bposte/i);
			expect(fr[key], key).not.toMatch(/\bplace/i);
		}
	});
});
