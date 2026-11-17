/**
 * Les budgets de livraison, mesurés en octets ou en requêtes. Le smoke de
 * conteneur, les tests de contrat et les générateurs lisent ce propriétaire
 * unique : aucun script ne recopie un seuil.
 */
export const PERFORMANCE_BUDGETS = {
	/** La tranche critique réellement inlinée dans la coquille. */
	authInlineCssBytes: 20 * 1024,
	/**
	 * Le vrai coût d'un graphe initial : les octets JavaScript non compressés.
	 * Mesuré au maximum 263 Kio sur /matchs/[id] au HEAD 1.6.0; les requêtes
	 * varient de 20 à 32 pour un poids presque identique (212 à 263 Kio), donc
	 * ce plafond mesure la charge, pas la fragmentation des morceaux.
	 */
	jsBytesPerPage: 320 * 1024,
	/**
	 * Le plafond par défaut des requêtes d'une page qui n'en déclare pas.
	 * Le smoke compte les liens du HTML serveur : les îlots asynchrones et les
	 * imports imbriqués chargés après la peinture ne sont pas comptés. Les
	 * plafonds par page restent donc des planchers conservateurs; l'audit
	 * navigateur (31 à 38 requêtes) fait foi jusqu'à une nouvelle mesure.
	 */
	jsRequestsPerPage: 20,
	/** La feuille de papier pleine page, chargée une fois et mise en cache. */
	paperTextureBytes: 160 * 1024,
	/**
	 * La glace pleine largeur de la patinoire, chargée seulement sur les pages
	 * de match. Elle n'est jamais répétée.
	 */
	rinkTextureBytes: 384 * 1024,
	/** La variante choisie pour la photo de connexion sur un téléphone étroit. */
	authMobileImageBytes: 72 * 1024,
	authDesktopImageBytes: 80 * 1024,
	/** La planche complète des portraits, chargée une fois et mise en cache. */
	identitySheetBytes: 220 * 1024
} as const;

export type PerformanceBudget = keyof typeof PERFORMANCE_BUDGETS;

export type MeasuredPage = {
	name: string;
	path: string;
	/**
	 * Plafond de fragmentation observé à la livraison 1.6.0. Il ne remplace
	 * pas le budget d'octets : il empêche une page de gagner des requêtes
	 * sans gagner de code. Une page qui n'a pas de mesure propre retombe sur
	 * `jsRequestsPerPage`. La liste couvre chaque route statique; une nouvelle
	 * route échoue au contrat tant que son budget n'est pas déclaré.
	 */
	maxRequests?: number;
	/**
	 * Le document HTML complet, mesures de livraison comprises. Chaque page
	 * mesurée par le smoke déclare son propre plafond : une page ne peut pas
	 * grossir sans que son propriétaire l'ait accepté. Une route à paramètre
	 * n'a pas de document mesurable dans un conteneur vide; son graphe reste
	 * borné par `jsBytesPerPage`.
	 */
	maxBytes?: number;
	/** Le compte avec lequel le smoke mesure la page. */
	audience: 'anonymous' | 'admin' | 'player';
	/**
	 * Une route à paramètre n'est pas demandée par le smoke du conteneur vide :
	 * elle se mesure en préversion avec les données de démonstration. Sa
	 * déclaration reste obligatoire pour que l'énumération des routes soit
	 * complète et que son plafond par défaut s'applique.
	 */
	preview?: true;
};

/**
 * Les routes dont le graphe JavaScript initial est mesuré. Le smoke du
 * conteneur demande chaque page statique; /equipes redirige et se mesure via sa
 * page de détail. Les six surfaces à paramètre (/matchs/[id], /equipes/[id],
 * /admin/matchs/[id], /admin/joueurs/[id], /admin/evaluations/[id],
 * /admin/evaluations/matchs/[id]) sont déclarées mais mesurées en préversion
 * avec les données de démonstration.
 */
export const MEASURED_PAGES: readonly MeasuredPage[] = [
	{
		name: 'connexion',
		path: '/connexion',
		maxRequests: 20,
		maxBytes: 60 * 1024,
		audience: 'anonymous'
	},
	{
		name: 'mot-de-passe-oublie',
		path: '/mot-de-passe-oublie',
		maxRequests: 17,
		maxBytes: 45 * 1024,
		audience: 'anonymous'
	},
	{
		name: 'reinitialiser-mot-de-passe',
		path: '/reinitialiser-mot-de-passe',
		maxRequests: 20,
		maxBytes: 45 * 1024,
		audience: 'anonymous'
	},
	{ name: 'home', path: '/', maxRequests: 20, maxBytes: 130 * 1024, audience: 'admin' },
	{
		name: 'profil',
		path: '/profil',
		maxRequests: 20,
		maxBytes: 120 * 1024,
		audience: 'player'
	},
	{
		name: 'discussion',
		path: '/discussion',
		// Le module partagé `chrome-inset.svelte.ts` (coquille admin et
		// discussion) ajoute une requête mesurée par le smoke du conteneur :
		// 21 requêtes pour cette page, sans changement du plafond d'octets.
		maxRequests: 21,
		maxBytes: 150 * 1024,
		audience: 'admin'
	},
	{ name: 'matchs', path: '/matchs', maxRequests: 26, maxBytes: 110 * 1024, audience: 'admin' },
	{
		name: 'equipes',
		path: '/equipes',
		audience: 'player',
		// La route redirige vers le match par défaut : le smoke mesurerait un
		// corps vide. La vraie page se mesure en préversion via /equipes/[id].
		preview: true
	},
	{
		name: 'remplacants',
		path: '/remplacants',
		maxRequests: 27,
		maxBytes: 110 * 1024,
		audience: 'admin'
	},
	{ name: 'solde', path: '/solde', maxRequests: 25, maxBytes: 110 * 1024, audience: 'admin' },
	{
		name: 'notifications',
		path: '/notifications',
		maxRequests: 22,
		maxBytes: 110 * 1024,
		audience: 'admin'
	},
	{
		name: 'admin',
		path: '/admin',
		// Le chunk partagé `chrome-inset.svelte.ts` (publication de
		// `surface-top-inset`, coquille admin et discussion) ajoute une requête
		// mesurée par le smoke : 29 requêtes, plafond d'octets inchangé.
		maxRequests: 29,
		maxBytes: 130 * 1024,
		audience: 'admin'
	},
	// Les pages de gestion chargent le morceau partagé `chrome-inset.svelte.ts`
	// (sous-barre mobile mesurée) : chaque plafond mesuré au smoke inclut
	// cette requête commune. Le tableau de bord `/admin` est mesuré à part.
	{
		name: 'admin-matchs',
		path: '/admin/matchs',
		maxRequests: 31,
		maxBytes: 140 * 1024,
		audience: 'admin'
	},
	{
		name: 'admin-joueurs',
		path: '/admin/joueurs',
		maxRequests: 30,
		maxBytes: 140 * 1024,
		audience: 'admin'
	},
	{
		name: 'admin-lieux',
		path: '/admin/lieux',
		maxRequests: 30,
		maxBytes: 140 * 1024,
		audience: 'admin'
	},
	{
		name: 'admin-regles',
		path: '/admin/regles',
		maxRequests: 28,
		maxBytes: 140 * 1024,
		audience: 'admin'
	},
	{
		name: 'admin-soldes',
		path: '/admin/soldes',
		maxRequests: 28,
		maxBytes: 140 * 1024,
		audience: 'admin'
	},
	{
		name: 'admin-evaluations',
		path: '/admin/evaluations',
		maxRequests: 26,
		maxBytes: 140 * 1024,
		audience: 'admin'
	},
	{
		name: 'admin-parametres',
		path: '/admin/parametres',
		maxRequests: 24,
		maxBytes: 140 * 1024,
		audience: 'admin'
	},
	{
		name: 'match-detail',
		path: '/matchs/[id]',
		audience: 'player',
		preview: true
	},
	{
		name: 'team-detail',
		path: '/equipes/[id]',
		audience: 'player',
		preview: true
	},
	{
		name: 'admin-match-detail',
		path: '/admin/matchs/[id]',
		audience: 'admin',
		preview: true
	},
	{
		name: 'admin-joueur-detail',
		path: '/admin/joueurs/[id]',
		audience: 'admin',
		preview: true
	},
	{
		name: 'admin-evaluation-detail',
		path: '/admin/evaluations/[id]',
		audience: 'admin',
		preview: true
	},
	{
		name: 'admin-evaluation-match',
		path: '/admin/evaluations/matchs/[id]',
		maxRequests: 28,
		audience: 'admin',
		preview: true
	}
];
