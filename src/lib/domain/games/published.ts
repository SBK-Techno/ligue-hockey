export type PublishedGame = {
	generatedAt: number | null;
	generationJson: string | null;
};

/**
 * Un alignement est publié quand les deux colonnes de la génération existent
 * ensemble. La contrainte de schéma interdit aujourd'hui une moitié seule;
 * ce prédicat est l'unique lecture de la règle, pour qu'une ligne partielle
 * ne soit jamais publiée par un consommateur qui n'en vérifie qu'une moitié.
 */
export function isPublished(game: PublishedGame): boolean {
	return game.generatedAt !== null && game.generationJson !== null;
}
