/**
 * Le seul propriétaire de la politique de cache des réponses. Un gestionnaire
 * de route qui déclare déjà une politique privée la garde : la politique de
 * session ne l'écrase plus. Le HTML anonyme et la santé ont une politique
 * explicite; les actifs gardent celle du framework.
 */
export type CachePolicyInput = {
	pathname: string;
	hasSession: boolean;
	/** La valeur déjà posée par le handler ou le framework, s'il y en a une. */
	declared: string | null;
	contentType: string | null;
};

const RESET_PATHS = ['/reinitialiser-mot-de-passe', '/api/auth/reset-password'];

function isResetPath(pathname: string): boolean {
	return RESET_PATHS.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`)
	);
}

function isPrivate(declared: string): boolean {
	const value = declared.toLowerCase();
	return value.includes('private') || value.includes('no-store');
}

/**
 * Retourne la valeur à poser, ou null pour laisser la réponse telle quelle.
 */
export function cacheControlFor(input: CachePolicyInput): string | null {
	if (input.pathname === '/api/health' || isResetPath(input.pathname)) {
		return 'no-store';
	}
	if (input.declared && isPrivate(input.declared)) {
		return null;
	}
	if (input.hasSession) {
		return 'private, no-store';
	}
	if (input.contentType?.includes('text/html')) {
		// La coquille d'authentification ne se met jamais en cache partagé.
		return 'private, no-store';
	}
	return null;
}
