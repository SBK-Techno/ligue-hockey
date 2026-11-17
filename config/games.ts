/**
 * Les bornes simples des formulaires de match et de lieu. Elles sont lues par
 * le client pour les attributs `maxlength`, donc ce module ne dépend jamais de
 * zod : les schémas serveur importent ces valeurs, pas l'inverse.
 */
export const GAME_LIMITS = {
	notesMax: 1000
} as const;

export const LOCATION_LIMITS = {
	nameMax: 120,
	addressMax: 200,
	mapUrlMax: 500,
	notesMax: 2000
} as const;
