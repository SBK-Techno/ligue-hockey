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
	/**
	 * Le vrai coût d'un graphe initial : les octets JavaScript non compressés.
	 * Mesuré au maximum 263 Kio sur /matchs/[id] au HEAD 1.6.0; les requêtes
	 * varient de 20 à 32 pour un poids presque identique (212 à 263 Kio), donc
	 * ce plafond mesure la charge, pas la fragmentation des morceaux.
	 */
	jsBytesPerPage: 320 * 1024,
	/** Le plafond par défaut d'une route qui n'a pas de budget déclaré. */
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

export type MeasuredPage = {
	name: string;
	path: string;
	/**
	 * Plafond de fragmentation observé à la livraison 1.6.0. Il ne remplace
	 * pas le budget d'octets : il empêche une page de gagner des requêtes
	 * sans gagner de code. La liste couvre chaque route statique; une nouvelle
	 * route échoue au contrat tant que son budget n'est pas déclaré.
	 */
	maxRequests: number;
	/** La page vit avant la connexion : le smoke la mesure sans session. */
	anonymous?: boolean;
};

/**
 * Les pages statiques dont le graphe JavaScript initial est mesuré. Les trois
 * surfaces à paramètre (/matchs/[id], /admin/matchs/[id], /admin/joueurs/[id])
 * ne sont pas mesurables dans un conteneur vide; leur mesure appartient au
 * contrôle de préversion avec les données de démonstration.
 */
export const MEASURED_PAGES: readonly MeasuredPage[] = [
	{ name: 'connexion', path: '/connexion', maxRequests: 20, anonymous: true },
	{ name: 'mot-de-passe-oublie', path: '/mot-de-passe-oublie', maxRequests: 17, anonymous: true },
	{
		name: 'reinitialiser-mot-de-passe',
		path: '/reinitialiser-mot-de-passe',
		maxRequests: 20,
		anonymous: true
	},
	{ name: 'home', path: '/', maxRequests: 20 },
	{ name: 'profil', path: '/profil', maxRequests: 20 },
	{ name: 'discussion', path: '/discussion', maxRequests: 20 },
	{ name: 'matchs', path: '/matchs', maxRequests: 26 },
	{ name: 'remplacants', path: '/remplacants', maxRequests: 27 },
	{ name: 'solde', path: '/solde', maxRequests: 25 },
	{ name: 'notifications', path: '/notifications', maxRequests: 22 },
	{ name: 'admin', path: '/admin', maxRequests: 28 },
	{ name: 'admin-matchs', path: '/admin/matchs', maxRequests: 30 },
	{ name: 'admin-joueurs', path: '/admin/joueurs', maxRequests: 29 },
	{ name: 'admin-lieux', path: '/admin/lieux', maxRequests: 29 },
	{ name: 'admin-regles', path: '/admin/regles', maxRequests: 27 },
	{ name: 'admin-soldes', path: '/admin/soldes', maxRequests: 27 },
	{ name: 'admin-evaluations', path: '/admin/evaluations', maxRequests: 25 },
	{ name: 'admin-parametres', path: '/admin/parametres', maxRequests: 23 }
];
