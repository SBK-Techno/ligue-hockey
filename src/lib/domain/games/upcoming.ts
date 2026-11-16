import { logger } from '#lib/shared/logging/logger.ts';
import { isLineupEditable } from './playability.ts';
import { listGames } from './queries.ts';
import { regenerateGame } from './service.ts';

export type UpcomingRegeneration = {
	regenerated: number;
	failed: number;
};

/**
 * Recalcule chaque match à venir déjà publié. Un changement de joueur, de
 * note ou de règle doit se refléter tout de suite dans les alignements, sans
 * qu'un administrateur ait à cliquer sur « Régénérer ».
 *
 * Un match qui ne peut pas être recalculé (notes incomplètes, par exemple) est
 * laissé tel quel et journalisé; les autres matchs sont quand même mis à jour.
 */
export function regenerateUpcomingGeneratedGames(): UpcomingRegeneration {
	let regenerated = 0;
	let failed = 0;

	for (const game of listGames()) {
		if (game.generatedAt === null) continue;
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
