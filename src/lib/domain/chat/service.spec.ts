import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La discussion porte l'identité visuelle du joueur et refuse un vote sur un
 * message supprimé. La pagination est vérifiée ici, au service, parce que le
 * curseur ne doit jamais dépendre de ce que la page affiche.
 */

const h = vi.hoisted(() => ({
	listMessages: vi.fn(),
	listLatestVisibleMessage: vi.fn(),
	listOpenPollMessages: vi.fn(),
	listPolls: vi.fn(),
	listOptions: vi.fn(),
	listVotes: vi.fn(),
	findMessage: vi.fn(),
	findPoll: vi.fn(),
	findOption: vi.fn(),
	castVote: vi.fn()
}));

vi.mock('./queries.ts', () => h);

vi.mock('#lib/domain/settings/service.ts', () => ({
	getSettings: () => ({ 'chat.pageSize': 50 })
}));

vi.mock('#lib/domain/auth/policy.ts', () => ({
	requireUser: () => ({ kind: 'user', active: true, userId: 'me', role: 'player', name: 'Moi' }),
	can: () => false,
	canCreatePoll: () => false
}));

vi.mock('#lib/domain/audit/service.ts', () => ({ recordAudit: vi.fn() }));

vi.mock('#lib/shared/time/clock.ts', () => ({
	clock: { nowMs: () => 1_000 }
}));

vi.mock('#lib/shared/i18n/index.ts', () => ({ t: (key: string) => key }));

import { castPollVote, listChatPage, listChatSummary } from './service.ts';

const message = {
	id: 'msg_1',
	authorUserId: 'me',
	authorName: 'Samuel Tremblay',
	authorAvatarId: 'tuque-rouge',
	authorJerseyNumber: 14,
	authorPosition: 'forward',
	kind: 'text',
	body: 'On part à quelle heure ?',
	createdAt: 900,
	deletedAt: null,
	deletedBy: null
};

const actor = {
	kind: 'user' as const,
	active: true,
	userId: 'me',
	role: 'player' as const,
	name: 'Moi'
};

function rows(count: number) {
	return Array.from({ length: count }, (_, index) => ({
		...message,
		id: `msg_${String(count - index).padStart(2, '0')}`,
		body: `Message ${count - index}`,
		createdAt: 10_000 - index
	}));
}

beforeEach(() => {
	vi.clearAllMocks();
	h.listMessages.mockReturnValue([message]);
	h.listLatestVisibleMessage.mockReturnValue(message);
	h.listOpenPollMessages.mockReturnValue([]);
	h.listPolls.mockReturnValue([]);
	h.listOptions.mockReturnValue([]);
	h.listVotes.mockReturnValue([]);
});

describe('discussion', () => {
	it('expose l’avatar, le chandail, le poste et le message du membre', () => {
		const [view] = listChatPage(actor).messages;

		expect(view).toMatchObject({
			authorAvatarId: 'tuque-rouge',
			authorJerseyNumber: 14,
			authorPosition: 'forward',
			isOwn: true
		});
	});

	it('compte les votes de chaque choix', () => {
		h.listMessages.mockReturnValue([{ ...message, kind: 'poll', body: null }]);
		h.listPolls.mockReturnValue([
			{ messageId: 'msg_1', question: 'On joue ?', closesAt: null, createdAt: 900 }
		]);
		h.listOptions.mockReturnValue([
			{ id: 'opt_1', messageId: 'msg_1', label: 'Oui', optionIndex: 0 },
			{ id: 'opt_2', messageId: 'msg_1', label: 'Non', optionIndex: 1 }
		]);
		h.listVotes.mockReturnValue([
			{ messageId: 'msg_1', optionId: 'opt_1', userId: 'me' },
			{ messageId: 'msg_1', optionId: 'opt_1', userId: 'autre' },
			{ messageId: 'msg_1', optionId: 'opt_2', userId: 'trois' }
		]);

		const [view] = listChatPage(actor).messages;

		expect(view?.poll?.options).toEqual([
			{ id: 'opt_1', label: 'Oui', votes: 2, myVote: true },
			{ id: 'opt_2', label: 'Non', votes: 1, myVote: false }
		]);
	});

	it('refuse un vote sur un message supprimé', () => {
		h.findMessage.mockReturnValue({ ...message, deletedAt: 950 });

		expect(() =>
			castPollVote(actor, { messageId: 'msg_1', optionId: 'opt_1' })
		).toThrowError();
		expect(h.findPoll).not.toHaveBeenCalled();
		expect(h.castVote).not.toHaveBeenCalled();
	});
});

describe('pagination de la discussion', () => {
	it('charge 20 messages, puis le curseur suivant sans doublon ni trou', () => {
		const all = rows(45);
		h.listMessages.mockImplementation(
			(limit: number, before: { createdAt: number; id: string } | null) => {
				const remaining = before
					? all.filter(
							(row) =>
								row.createdAt < before.createdAt ||
								(row.createdAt === before.createdAt && row.id < before.id)
						)
					: all;
				return remaining.slice(0, limit);
			}
		);

		const first = listChatPage(actor);
		expect(first.messages).toHaveLength(20);
		expect(first.messages[0].id).toBe('msg_45');
		expect(first.messages.at(-1)?.id).toBe('msg_26');
		expect(first.nextCursor).not.toBeNull();
		expect(h.listMessages).toHaveBeenCalledWith(21, null);

		const second = listChatPage(actor, first.nextCursor);
		expect(second.messages).toHaveLength(20);
		expect(second.messages[0].id).toBe('msg_25');
		expect(second.messages.at(-1)?.id).toBe('msg_06');
		expect(second.nextCursor).not.toBeNull();

		const third = listChatPage(actor, second.nextCursor);
		expect(third.messages).toHaveLength(5);
		expect(third.messages[0].id).toBe('msg_05');
		expect(third.messages.at(-1)?.id).toBe('msg_01');
		expect(third.nextCursor).toBeNull();
	});

	it('ignore un curseur invalide et repart de la première page', () => {
		listChatPage(actor, 'pas-un-curseur');
		expect(h.listMessages).toHaveBeenCalledWith(21, null);
	});
});

describe('résumé de l’accueil', () => {
	it('ne charge qu’un message et les sondages ouverts', () => {
		const poll = {
			...message,
			id: 'msg_poll',
			kind: 'poll',
			body: null,
			createdAt: 950
		};
		h.listLatestVisibleMessage.mockReturnValue(message);
		h.listOpenPollMessages.mockReturnValue([poll]);
		h.listPolls.mockReturnValue([
			{ messageId: 'msg_poll', question: 'On joue ?', closesAt: null, createdAt: 950 }
		]);
		h.listOptions.mockReturnValue([
			{ id: 'opt_1', messageId: 'msg_poll', label: 'Oui', optionIndex: 0 }
		]);
		h.listVotes.mockReturnValue([]);

		const summary = listChatSummary(actor);

		expect(h.listLatestVisibleMessage).toHaveBeenCalledTimes(1);
		expect(summary.latestMessage?.id).toBe('msg_1');
		expect(summary.openPoll).toMatchObject({
			messageId: 'msg_poll',
			unvoted: true
		});
	});
});
