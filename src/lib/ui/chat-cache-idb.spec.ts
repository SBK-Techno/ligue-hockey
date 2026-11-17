import { describe, expect, it } from 'vitest';
import type { ChatMessageView } from '#lib/domain/chat/service.ts';
import { clearChatCache, writeChatMessages } from './chat-cache-idb.ts';

/**
 * Le stockage local doit se fermer dès la déconnexion : une synchronisation
 * déjà en vol répond après l'effacement et ne doit rien réécrire. Ces cas
 * tournent sans IndexedDB : la fermeture précède la tentative de stockage.
 */
const message: ChatMessageView = {
	id: 'msg_1',
	authorUserId: 'user_1',
	authorName: 'Samuel Tremblay',
	authorAvatarId: null,
	authorJerseyNumber: null,
	authorPosition: null,
	isOwn: false,
	kind: 'text',
	body: 'Bonjour',
	createdAt: 1,
	deleted: false,
	poll: null,
	canDelete: false
};

describe('cache de discussion sur l’appareil', () => {
	it('ferme les écritures du membre dès l’effacement', async () => {
		expect(await clearChatCache('member-cleared')).toBe(false);

		expect(
			await writeChatMessages('member-cleared', [message], {
				complete: false,
				syncedAt: null
			})
		).toBeNull();
		expect(
			await writeChatMessages('member-cleared', [], {
				complete: true,
				syncedAt: 5
			})
		).toBeNull();
	});
});
