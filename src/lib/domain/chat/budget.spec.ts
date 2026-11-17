import { describe, expect, it } from 'vitest';
import { ABUSE_LIMITS } from '#config/abuse.ts';
import {
	CHAT_HISTORY_PREFETCH_PAGES,
	CHAT_POSITION_LOOKUP_PAGES,
	CHAT_RAIL_MIN_WIDTH,
	CHAT_SYNC_MAX_PAGES
} from '#config/chat.ts';

/**
 * Une ouverture peut parcourir la position, combler un trou, synchroniser et
 * précharger avant la première minute. La somme doit rester sous le seau de
 * lecture du membre, sinon la page se ferait refuser sa propre historique.
 */
describe('budget de lecture de la discussion', () => {
	it('garde la rafale d’ouverture sous le seau du membre', () => {
		const syncTicksPerMinute = Math.ceil(60_000 / 15_000);
		const burst =
			CHAT_POSITION_LOOKUP_PAGES +
			CHAT_HISTORY_PREFETCH_PAGES +
			CHAT_SYNC_MAX_PAGES * 2 +
			syncTicksPerMinute;

		expect(burst).toBeLessThanOrEqual(ABUSE_LIMITS.chatRead.limit);
	});

	it('garde le seuil de la colonne aligné sur xl de Tailwind', () => {
		// Le balisage porte `xl:` (80rem = 1280 px); les deux valeurs changent
		// ensemble, et ce test est le contrat qui les relie.
		expect(CHAT_RAIL_MIN_WIDTH).toBe(1280);
	});
});
