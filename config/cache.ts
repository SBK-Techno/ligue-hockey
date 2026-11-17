/**
 * Les politiques de cache des réponses qui ne sont pas des actifs générés.
 * Un consommateur ne recopie ni la durée ni l'en-tête : il importe la
 * politique entière.
 */
import { ADDRESS_SEARCH } from './maps.ts';

/** La fiche publique d'un joueur reste privée et courte. */
export const PEEK_PUBLIC_MAX_AGE_SECONDS = 15;
export const PEEK_PUBLIC_CACHE = `private, max-age=${PEEK_PUBLIC_MAX_AGE_SECONDS}`;

/** Une fiche qui contient les notes ne doit jamais resservir. */
export const PEEK_RATINGS_CACHE = 'no-store';

/** La fiche déjà chargée reste en mémoire du client pendant cette fenêtre :
 * plus longue que l'en-tête HTTP, elle évite de refaire la requête pendant
 * une visite, sans garder une fiche privée au-delà. */
export const PEEK_CLIENT_TTL_MS = 30_000;

/** Les suggestions d'adresses restent privées et suivent le cache serveur. */
export const ADDRESS_SEARCH_CACHE = `private, max-age=${Math.floor(
	ADDRESS_SEARCH.cacheTtlMs / 1000
)}`;
