/**
 * Les politiques de cache des réponses qui ne sont pas des actifs générés.
 * Un consommateur ne recopie ni la durée ni l'en-tête : il importe la
 * politique entière.
 */

/** La fiche publique d'un joueur reste privée et courte. */
export const PEEK_PUBLIC_MAX_AGE_SECONDS = 15;
export const PEEK_PUBLIC_CACHE = `private, max-age=${PEEK_PUBLIC_MAX_AGE_SECONDS}`;

/** Une fiche qui contient les notes ne doit jamais resservir. */
export const PEEK_RATINGS_CACHE = 'no-store';
