import { logger } from '#lib/shared/logging/logger.ts';
import { isLineupEditable } from './playability.ts';
import { listGames } from './queries.ts';
import { regenerateGame } from './service.ts';

export type UpcomingRegeneration = {
	regenerated: number;
	failed: number;
};

/** La fenêtre de coalescence : N écritures rapides donnent un seul recalcul. */
export const UPCOMING_REGENERATION_WINDOW_MS = 250;

let timer: ReturnType<typeof setTimeout> | null = null;

function run(): UpcomingRegeneration {
	let regenerated = 0;
	let failed = 0;

	for (const game of listGames()) {
		if (game.generatedAt === null) continue;
		// Un alignement manuel n'est jamais écrasé par un recalcul automatique.
		if (game.lineupManualAt !== null) continue;
		// Un match commencé, terminé ou annulé ne se recalcule jamais : son
		// alignement publié est figé.
		if (
			!isLineupEditable({
				status: game.status,
				gameDate: game.gameDate,
				startTime: game.startTime
			})
		) {
			continue;
		}
		try {
			regenerateGame(game.id);
			regenerated += 1;
		} catch (error) {
			failed += 1;
			logger.error('game.upcoming_regenerate_failed', {
				gameId: game.id,
				error
			});
		}
	}

	return { regenerated, failed };
}

/**
 * Recalcule chaque match à venir déjà publié, au plus une fois par fenêtre.
 * Les écritures rapprochées (présences, notes, règles) marquent le besoin;
 * le premier appel programme le balayage, les suivants se contentent de le
 * rejoindre.
 */
export function regenerateUpcomingGeneratedGames(): void {
	if (timer !== null) return;
	timer = setTimeout(() => {
		timer = null;
		run();
	}, UPCOMING_REGENERATION_WINDOW_MS);
	// Le minuteur ne retient jamais le processus en vie.
	timer.unref?.();
}

/** Le balayage immédiat, pour l'arrêt du serveur et les tests. */
export function flushUpcomingRegeneration(): UpcomingRegeneration {
	if (timer !== null) {
		clearTimeout(timer);
		timer = null;
	}
	return run();
}

/**
 * Arrêt propre : le dernier balayage en attente part avant la fermeture de la
 * base, jamais après.
 */
export function stopUpcomingRegeneration(): void {
	if (timer === null) return;
	flushUpcomingRegeneration();
}
