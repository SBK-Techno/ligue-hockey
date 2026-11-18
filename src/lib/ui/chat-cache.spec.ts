import { describe, expect, it } from 'vitest';
import type { ChatMessageView, ChatPollView } from '#lib/domain/chat/service.ts';
import {
	applyDeletedIds,
	applyPollStates,
	cacheIsComplete,
	chatCacheMeta,
	chatCacheSnapshot,
	compareChatMessages,
	isNewerChatMessage,
	mergeChatMessages,
	plainChatMessage
} from './chat-cache.ts';

function poll(question: string, closed = false): ChatPollView {
	return {
		question,
		closesAt: closed ? 1 : null,
		closed,
		options: [{ id: 'opt_1', label: 'Oui', votes: 1, myVote: false }]
	};
}

function message(
	id: string,
	createdAt: number,
	extra: Partial<ChatMessageView> = {}
): ChatMessageView {
	return {
		id,
		authorUserId: 'user_1',
		authorName: 'Samuel Tremblay',
		authorAvatarId: null,
		authorJerseyNumber: 14,
		authorPosition: 'forward',
		isOwn: false,
		kind: 'text',
		body: id,
		createdAt,
		deleted: false,
		poll: null,
		canDelete: false,
		...extra
	};
}

describe('cache de conversation', () => {
	it('trie du plus ancien au plus récent et départage par identifiant', () => {
		const sorted = [message('b', 10), message('a', 10), message('c', 9)].sort(
			compareChatMessages
		);

		expect(sorted.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
		expect(isNewerChatMessage(message('b', 10), message('a', 10))).toBe(true);
		expect(isNewerChatMessage(message('a', 10), message('b', 10))).toBe(false);
	});

	it('fusionne par identifiant et laisse le message entrant gagner', () => {
		const existing = [message('a', 1), message('b', 2, { body: 'ancien' })];
		const incoming = [message('b', 2, { body: 'neuf' }), message('c', 3)];

		const merged = mergeChatMessages(existing, incoming);

		expect(merged.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
		expect(merged[1].body).toBe('neuf');
	});

	it('garde la même référence quand une synchronisation n’apporte rien', () => {
		// Sans cette identité, un fil vide de nouveaux messages invaliderait
		// tout le rendu à chaque tick de 15 s, chaque vote et chaque page.
		const existing = [message('a', 1), message('b', 2)];

		expect(mergeChatMessages(existing, [])).toBe(existing);
		expect(applyDeletedIds(existing, [])).toBe(existing);
		expect(applyPollStates(existing, [])).toBe(existing);
		expect(applyDeletedIds(existing, ['inconnu'])).toBe(existing);
		expect(applyPollStates(existing, [{ id: 'inconnu', poll: null }])).toBe(existing);
	});

	it('produit une nouvelle référence dès qu’un message change vraiment', () => {
		const existing = [message('a', 1), message('b', 2)];
		const withPoll = [message('p', 1, { kind: 'poll', body: null, poll: poll('Q') })];

		expect(mergeChatMessages(existing, [message('c', 3)])).not.toBe(existing);
		expect(applyDeletedIds(existing, ['a'])).not.toBe(existing);
		expect(applyPollStates(withPoll, [{ id: 'p', poll: poll('Q', true) }])).not.toBe(withPoll);
	});

	it('marque une suppression sans perdre l’auteur ni l’heure', () => {
		const before = message('a', 1, { body: 'texte' });
		const [after] = applyDeletedIds([before], ['a']);

		expect(after).toMatchObject({
			id: 'a',
			authorName: 'Samuel Tremblay',
			createdAt: 1,
			body: null,
			deleted: true,
			poll: null,
			canDelete: false
		});
	});

	it('remplace l’état d’un sondage et retire un sondage supprimé', () => {
		const before = message('a', 1, { kind: 'poll', body: null, poll: poll('On joue ?') });
		const [updated] = applyPollStates([before], [
			{ id: 'a', poll: poll('On joue ?', true) }
		]);
		expect(updated.poll?.closed).toBe(true);

		const [removed] = applyPollStates([before], [{ id: 'a', poll: null }]);
		expect(removed).toMatchObject({
			id: 'a',
			body: null,
			deleted: true,
			poll: null,
			canDelete: false
		});
	});

	it('copie le message et ses options en objets simples', () => {
		const original = message('a', 1, {
			kind: 'poll',
			body: null,
			poll: poll('On joue ?')
		});

		const copy = plainChatMessage(original);

		expect(copy).toEqual(original);
		expect(copy).not.toBe(original);
		expect(copy.poll).not.toBe(original.poll);
		expect(copy.poll?.options[0]).not.toBe(original.poll?.options[0]);
	});

	it('déduit les deux curseurs des messages conservés', () => {
		const meta = chatCacheMeta([message('a', 10), message('b', 20)], {
			complete: false,
			syncedAt: 99
		});

		expect(meta).toEqual({
			oldestCursor: '10:a',
			latestCursor: '20:b',
			complete: false,
			syncedAt: 99
		});
	});

	it('invalide la complétude dès qu’une éviction retire une ligne', () => {
		expect(cacheIsComplete(true, 0)).toBe(true);
		expect(cacheIsComplete(true, 1)).toBe(false);
		expect(cacheIsComplete(false, 0)).toBe(false);
	});

	it('rend un instantané trié et vide sans message', () => {
		const snapshot = chatCacheSnapshot([message('b', 2), message('a', 1)], {
			complete: true,
			syncedAt: 5
		});
		expect(snapshot.messages.map((entry) => entry.id)).toEqual(['a', 'b']);
		expect(snapshot.complete).toBe(true);

		expect(chatCacheSnapshot([], { complete: false, syncedAt: null })).toEqual({
			messages: [],
			oldestCursor: null,
			latestCursor: null,
			complete: false,
			syncedAt: null
		});
	});
});
