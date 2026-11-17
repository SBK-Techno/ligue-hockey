import { ABUSE_LIMITS } from '#config/abuse.ts';
import { requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { AppError } from '#lib/shared/errors.ts';
import { consumeAttempt } from './throttle.ts';

const MEMBER_ACTION_PREFIX = 'member-action:';

/**
 * Les routes d'authentification et de santé ne sont pas des gestes de membre :
 * leur propre limiteur ou leur lecture seule les protège. La déconnexion reste
 * joignable même après une rafale, sinon un membre se verrouille lui-même.
 */
const EXEMPT_PREFIXES = ['/api/auth/'] as const;
const EXEMPT_PATHS = new Set([
	'/api/health',
	'/connexion',
	'/mot-de-passe-oublie',
	'/reinitialiser-mot-de-passe',
	'/deconnexion'
]);

export function memberActionExempt(pathname: string): boolean {
	if (EXEMPT_PATHS.has(pathname)) return true;
	return EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Toute écriture de membre passe par le même seau, une fois par requête. */
export function isMemberWrite(method: string, pathname: string): boolean {
	if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
	return !memberActionExempt(pathname);
}

/**
 * Le seul limiteur des gestes de membre (présence, profil, discussion). Un
 * seau par acteur : les écritures rapides d'un même compte se suivent, sans
 * pénaliser les autres membres. La réservation est atomique pour qu'une rafale
 * parallèle ne dépasse jamais la limite.
 */
export function throttleMemberAction(actor: Actor): void {
	const user = requireUser(actor);
	const key = `${MEMBER_ACTION_PREFIX}${user.userId}`;
	const limit = ABUSE_LIMITS.memberAction;
	if (!consumeAttempt(key, limit.limit, limit.windowMs)) {
		throw new AppError('RATE_LIMITED');
	}
}
