import { describe, expect, it } from 'vitest';
import type { ChatMessageView, ChatPollView } from '#lib/domain/chat/service.ts';
import { pollEntries } from './chat-polls.ts';

function poll(question: string, closed = false): ChatPollView {
	return {
		question,
		closesAt: closed ? 1 : null,
		closed,
		options: [{ id: 'opt_1', label: 'Oui', votes: 0, myVote: false }]
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
		authorJerseyNumber: null,
		authorPosition: null,
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

describe('colonne des sondages', () => {
	it('place les sondages ouverts devant, puis les plus récents', () => {
		const entries = pollEntries([
			message('older_closed', 1, { kind: 'poll', poll: poll('Fermé', true) }),
			message('newer_closed', 4, { kind: 'poll', poll: poll('Fermé récent', true) }),
			message('older_open', 2, { kind: 'poll', poll: poll('Ouvert') }),
			message('newer_open', 3, { kind: 'poll', poll: poll('Ouvert récent') }),
			message('text', 5)
		]);

		expect(entries.map((entry) => entry.message.id)).toEqual([
			'newer_open',
			'older_open',
			'newer_closed',
			'older_closed'
		]);
	});

	it('retire un sondage supprimé de la colonne', () => {
		const entries = pollEntries([
			message('poll', 1, { kind: 'poll', poll: poll('Ouvert') }),
			message('deleted', 2, { kind: 'poll', poll: null, deleted: true })
		]);

		expect(entries.map((entry) => entry.message.id)).toEqual(['poll']);
	});
});
