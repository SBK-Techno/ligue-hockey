import { json } from '@sveltejs/kit';
import { ABUSE_LIMITS } from '#config/abuse.ts';
import { CHAT_SYNC_CACHE } from '#config/cache.ts';
import { requireUser } from '#lib/domain/auth/policy.ts';
import { listChatPage, syncChat } from '#lib/domain/chat/service.ts';
import { apiError } from '#lib/server/action.ts';
import { consumeAttempt } from '#lib/server/security/throttle.ts';
import { AppError } from '#lib/shared/errors.ts';
import type { RequestHandler } from './$types';

/**
 * Transport only: `before` charge la page précédente dans le contrat
 * existant, `after` synchronise l'appareil. Sans curseur, la page la plus
 * récente alimente un fil vide, comme le rendu serveur. Le service décide de
 * l'ordre et du curseur; la route ne lit que les paramètres et le seau.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const user = requireUser(locals.actor);

		const limit = ABUSE_LIMITS.chatRead;
		if (
			!consumeAttempt(`chat-read:${user.userId}`, limit.limit, limit.windowMs)
		) {
			throw new AppError('RATE_LIMITED');
		}

		const before = url.searchParams.get('before');
		if (before !== null) {
			const page = listChatPage(locals.actor, before);
			return json(
				{ messages: page.messages, nextCursor: page.nextCursor },
				{ headers: { 'cache-control': CHAT_SYNC_CACHE } }
			);
		}

		const after = url.searchParams.get('after');
		if (after === null) {
			// Aucun curseur : un fil vide demande la page la plus récente,
			// exactement comme le rendu serveur.
			const page = listChatPage(locals.actor, null);
			return json(
				{ messages: page.messages, nextCursor: page.nextCursor },
				{ headers: { 'cache-control': CHAT_SYNC_CACHE } }
			);
		}
		// Une valeur vide reste une requête malformée, jamais « la dernière page ».
		if (after.length === 0) {
			throw new AppError('VALIDATION', { key: 'chat.invalidCursor' });
		}

		const deletedSinceValue = url.searchParams.get('deletedSince');
		return json(
			syncChat(locals.actor, {
				after,
				deletedSince: deletedSinceValue ? Number(deletedSinceValue) : null
			}),
			{ headers: { 'cache-control': CHAT_SYNC_CACHE } }
		);
	} catch (cause) {
		return apiError(cause);
	}
};
