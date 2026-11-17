/**
 * Les budgets de livraison, mesurés en octets ou en requêtes. Le smoke de
 * conteneur, les tests de contrat et les générateurs lisent ce propriétaire
 * unique : aucun script ne recopie un seuil.
 */
export const PERFORMANCE_BUDGETS = {
	/** Le document de connexion, sans compter l'image chargée par le navigateur. */
	authHtmlBytes: 60 * 1024,
	/** La tranche critique réellement inlinée dans la coquille. */
	authInlineCssBytes: 20 * 1024,
	/** Une page de discussion avec 20 messages et une seule boîte de dialogue. */
	discussionHtmlBytes: 150 * 1024,
	profileHtmlBytes: 120 * 1024,
	/** Requêtes JavaScript du graphe initial d'une page. */
	jsRequestsPerPage: 20,
	/** Une tuile de texture tuilée à l'échelle 1:1. */
	textureBytes: 5 * 1024,
	/** La variante mobile de la photo de connexion. */
	authMobileImageBytes: 35 * 1024,
	authDesktopImageBytes: 80 * 1024,
	/** Le sprite complet des identités, chargé une fois et mis en cache. */
	identitySpriteBytes: 220 * 1024
} as const;

export type PerformanceBudget = keyof typeof PERFORMANCE_BUDGETS;

/**
 * Les pages dont le graphe JavaScript initial est mesuré. Cette liste est le
 * seul propriétaire des routes vérifiées : le smoke l'itère, il n'en recopie
 * aucune, et une page ajoutée ici est contrôlée comme les autres.
 */
export const MEASURED_PAGES = [
	{ name: 'home', path: '/', budget: 'jsRequestsPerPage' },
	{ name: 'profil', path: '/profil', budget: 'jsRequestsPerPage' },
	{ name: 'discussion', path: '/discussion', budget: 'jsRequestsPerPage' }
] as const satisfies readonly { name: string; path: string; budget: PerformanceBudget }[];
