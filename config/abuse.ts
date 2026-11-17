/**
 * Les limites d'abus des gestes de membre. Un seul propriétaire : les routes
 * et les services lisent ces valeurs, jamais une constante locale.
 */
export const ABUSE_LIMITS = {
	/** Toutes les actions de formulaire d'un même membre, ensemble. */
	memberAction: { limit: 40, windowMs: 60_000 },
	/** Les fiches de joueur ouvertes par un même membre. */
	peek: { limit: 120, windowMs: 60_000 },
	/** Les recherches d'adresse d'un même gestionnaire. */
	addressSearch: { limit: 60, windowMs: 60_000 },
	/** Les appareils push enregistrés par un même membre. */
	pushSubscription: { limit: 10 }
} as const;
