/**
 * Les événements DOM internes qui réveillent un hôte paresseux. Chaque nom a
 * un seul propriétaire ici : le store qui le diffuse et la coquille qui
 * l'écoute lisent la même constante.
 */
export const CONFIRM_REQUEST_EVENT = 'app:confirm-request';
export const PLAYER_PEEK_EVENT = 'app:player-peek';
