/**
 * Le contrat de pagination de la discussion. La valeur est aussi le maximum
 * accepté par le réglage `chat.pageSize` : un administrateur peut charger
 * moins, jamais plus.
 */
export const CHAT_PAGE_SIZE = 20;

/** Les sondages ouverts examinés pour le résumé de l'accueil. */
export const HOME_POLL_LIMIT = 10;

/** Les messages d'une page de synchronisation, du plus ancien au plus récent. */
export const CHAT_SYNC_PAGE_SIZE = 100;

/**
 * Les pages qu'une synchronisation ou un rattrapage parcourt avant de rendre
 * la main. Le budget de lecture de `config/abuse.ts` couvre la somme des
 * parcours d'une ouverture, vérifiée par `config/chat.spec.ts`.
 */
export const CHAT_SYNC_MAX_PAGES = 20;

/** Les pages parcourues pour retrouver la position de lecture enregistrée. */
export const CHAT_POSITION_LOOKUP_PAGES = 40;

/** Les pages d'historique préchargées après l'ouverture. */
export const CHAT_HISTORY_PREFETCH_PAGES = 20;

/** Les identifiants supprimés rattrapés par une synchronisation. */
export const CHAT_DELETED_SYNC_LIMIT = 500;

/**
 * Les sondages dont chaque synchronisation rafraîchit l'état : les plus
 * récents. Au-delà, un rechargement complet fait foi; la colonne ne prétend
 * pas rafraîchir un sondage sorti de ce catalogue.
 */
export const CHAT_POLL_SYNC_LIMIT = 100;

/** Le plafond de sécurité du cache de conversation sur l'appareil. */
export const CHAT_CACHE_MAX_MESSAGES = 20_000;

/** La largeur à partir de laquelle les sondages passent dans la colonne. */
export const CHAT_RAIL_MIN_WIDTH = 1280;
