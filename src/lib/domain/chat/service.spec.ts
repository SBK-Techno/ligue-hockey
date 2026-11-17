import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La discussion porte l'identité visuelle du joueur et refuse un vote sur un
 * message supprimé. Ces deux règles sont vérifiées ici, au service, parce
 * qu'elles ne doivent jamais dépendre de ce que la page affiche.
 */

const h = vi.hoisted(() => ({
	listMessages: vi.fn(),
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

import { castPollVote, listChat } from './service.ts';

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

describe('discussion', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		h.listMessages.mockReturnValue([message]);
		h.listPolls.mockReturnValue([]);
		h.listOptions.mockReturnValue([]);
		h.listVotes.mockReturnValue([]);
	});

	it('expose l’avatar, le chandail, le poste et le message du membre', () => {
		const [view] = listChat({
			kind: 'user', active: true,
			userId: 'me',
			role: 'player',
			name: 'Moi'
		});

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

		const [view] = listChat({
			kind: 'user', active: true,
			userId: 'me',
			role: 'player',
			name: 'Moi'
		});

		expect(view?.poll?.options).toEqual([
			{ id: 'opt_1', label: 'Oui', votes: 2, myVote: true },
			{ id: 'opt_2', label: 'Non', votes: 1, myVote: false }
		]);
	});

	it('refuse un vote sur un message supprimé', () => {
		h.findMessage.mockReturnValue({ ...message, deletedAt: 950 });

		expect(() =>
			castPollVote(
				{ kind: 'user', active: true, userId: 'me', role: 'player', name: 'Moi' },
				{ messageId: 'msg_1', optionId: 'opt_1' }
			)
		).toThrowError();
		expect(h.findPoll).not.toHaveBeenCalled();
		expect(h.castVote).not.toHaveBeenCalled();
	});
});
