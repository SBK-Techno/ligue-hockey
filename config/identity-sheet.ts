/**
 * La planche des portraits d'identités : une seule image, une tuile carrée par
 * identité, dans l'ordre de `config/identities.ts`. Le générateur compose la
 * planche à partir des sources peintes; l'avatar ne lit que la colonne et la
 * ligne de son identité. Une nouvelle identité ajoute une tuile, jamais un
 * second fichier.
 */
export const IDENTITY_SHEET = {
	/** Huit portraits par ligne; une tuile de 192 px couvre un avatar de 96 px à 2x. */
	columns: 8,
	/** Résolution native d'une tuile dans la planche livrée. */
	tileSize: 192,
	webpQuality: 76,
	/** Les portraits peints, un fichier par identifiant d'identité. */
	sourceDir: 'config/branding/portraits',
	sourceExtension: '.webp'
} as const;
