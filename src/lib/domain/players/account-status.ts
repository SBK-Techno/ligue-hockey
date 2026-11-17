import { findPlayer } from './queries.ts';

/**
 * Whether an account may act. League accounts without a player profile are
 * not deactivatable players, so they stay active; a player row decides for a
 * member. The session hook resolves this once per request so an inactive
 * account cannot keep a manager capability through an old cookie.
 */
export function isAccountActive(userId: string): boolean {
	return findPlayer(userId)?.active ?? true;
}
