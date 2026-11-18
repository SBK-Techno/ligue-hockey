import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Le fil garde trois invariants que le rendu seul ne peut pas prouver : le
 * cache précède toute observation, une page plus ancienne s'ancre sur le
 * message lu, et la colonne des sondages n'existe qu'à partir du seuil large.
 */
const page = readFileSync('src/routes/discussion/+page.svelte', 'utf8');

describe('comportement de la discussion', () => {
	it('pose le cache et la lecture avant d’observer la sentinelle', () => {
		expect(page).toContain('await tick();\n\t\thydrated = true;');
		expect(page).toContain('if (!settled) return;');
		expect(page).toContain('settled = true;');
	});

	it('garde le message lu au même endroit quand une page plus ancienne arrive', () => {
		const start = page.indexOf('async function loadOlderPage');
		const end = page.indexOf('async function sync');
		const older = page.slice(start, end);

		expect(start).toBeGreaterThan(-1);
		expect(older).toContain('const anchor = options.preserveScroll ? currentAnchor() : null;');
		expect(older).toContain('if (anchor) scrollToAnchor(anchor);');
		expect(older).not.toContain('scrollBy');
		// La correction d'ancre précède la persistance : aucune peinture ne
		// montre les lignes ajoutées sans compensation de scroll.
		expect(older.indexOf('if (anchor) scrollToAnchor(anchor);')).toBeLessThan(
			older.indexOf('await writeChatMessages')
		);
	});

	it('n’affiche les sondages dans la colonne qu’au seuil large', () => {
		expect(page).toContain("aria-label={t('chat.pollsTitle')}");
		expect(page).toContain('hidden xl:block');
		expect(page).toContain('xl:grid-cols-[minmax(0,1fr)_20rem]');
	});

	it('rafraîchit un fil vide sans curseur plutôt que de rester muet', () => {
		expect(page).toContain('await refreshLatest();');
		expect(page).toContain("fetch('/api/discussion/messages', {");
	});

	it('comble le trou entre la copie locale et la page serveur', () => {
		expect(page).toContain('pendingGapCursor');
		expect(page).toContain('bridgeCacheGap');
		expect(page).toContain('compareChatMessages(cachedLatest, oldestServer) < 0');
		expect(page).toContain('if (!bridged) await resetLocalCopy();');
	});

	it('pilote la colonne des sondages en CSS, sans déplacement après peinture', () => {
		// Les deux copies existent dès le rendu serveur; la largeur décide.
		// Aucun état de largeur ni bascule au montage : pas de saut à l'hydratation.
		expect(page).toContain('data-poll={message.poll && !message.deleted');
		expect(page).toContain("message.poll && !message.deleted ? 'xl:hidden' : ''");
		expect(page).not.toContain('sidePolls');
		expect(page).not.toContain('shouldShowPollRail');
		expect(page).not.toContain("window.addEventListener('resize'");
	});

	it('jette la copie locale quand le serveur ne peut plus prouver les suppressions', () => {
		expect(page).toContain('if (payload.reset === true)');
		expect(page).toContain('await clearChatCache(viewerId);');
		expect(page).toContain('window.location.reload();');
	});

	it('pose le compositeur au-dessus du pied flottant du bureau', () => {
		expect(page).toContain(
			'lg:bottom-[calc(var(--footer-offset)+0.25rem)]'
		);
	});
});
