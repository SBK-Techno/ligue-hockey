import { describe, expect, it } from 'vitest';
import { timeInZone, todayInZone } from './clock.ts';

/**
 * La date et l'heure de la ligue sortent d'un seul convertisseur. Minuit ne
 * doit jamais devenir `24:00` dans une comparaison SQL ou un formulaire.
 */
describe('heure de la ligue', () => {
	const zone = 'America/Toronto';

	it('rend la date locale au passage de minuit UTC', () => {
		// 2026-11-17 03:30 UTC = 2026-11-16 22:30 à Toronto.
		expect(todayInZone(zone, Date.UTC(2026, 10, 17, 3, 30))).toBe('2026-11-16');
	});

	it('rend l’heure locale sur 24 heures', () => {
		expect(timeInZone(zone, Date.UTC(2026, 10, 17, 3, 30))).toBe('22:30');
	});

	it('ramène minuit à 00:00, jamais 24:00', () => {
		// 2026-11-17 05:00 UTC = 2026-11-17 00:00 à Toronto (EST).
		expect(timeInZone(zone, Date.UTC(2026, 10, 17, 5, 0))).toBe('00:00');
	});
});
