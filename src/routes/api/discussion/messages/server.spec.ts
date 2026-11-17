import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ABUSE_LIMITS } from '#config/abuse.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import type { ChatMessageView } from '#lib/domain/chat/service.ts';
import { consumeAttempt, resetThrottle } from '#lib/server/security/throttle.ts';

/**
 * La route est un transport : les tests vérifient le contrat des deux
 * fenêtres, le seau de lecture et l'enveloppe d'erreur, jamais la SQL.
 */

vi.mock('#lib/domain/chat/service.ts', () => ({
	listChatPage: vi.fn(),
	syncChat: vi.fn()
}));

const { listChatPage, syncChat } = await import('#lib/domain/chat/service.ts');
const { GET } = await import('./+server.ts');

const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'player',
	name: 'Joueur',
	role: 'player'
};

const anonymous: Actor = { kind: 'anonymous' };

function view(id: string, createdAt: number): ChatMessageView {
	return {
		id,
		authorUserId: 'player',
		authorName: 'Samuel Tremblay',
		authorAvatarId: null,
		authorJerseyNumber: null,
		authorPosition: null,
		isOwn: false,
		kind: 'text',
		body: `Message ${id}`,
		createdAt,
		deleted: false,
		poll: null,
		canDelete: false
	};
}

async function call(actor: Actor, params: Record<string, string> = {}) {
	const url = new URL('http://localhost/api/discussion/messages');
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return GET({ locals: { actor }, url } as never);
}

beforeEach(() => {
	vi.mocked(listChatPage).mockReset();
	vi.mocked(syncChat).mockReset();
	resetThrottle();
});

describe('messages de la discussion', () => {
	it('refuse un compte sans session', async () => {
		const response = await call(anonymous, { after: '1000:msg_1' });

		expect(response.status).toBe(401);
		expect(syncChat).not.toHaveBeenCalled();
	});

	it('rend la page la plus récente pour un fil vide, sans curseur', async () => {
		const messages = [view('msg_2', 2_000), view('msg_1', 1_000)];
		vi.mocked(listChatPage).mockReturnValue({
			messages,
			nextCursor: '1000:msg_1'
		});

		const response = await call(player);

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual({
			messages,
			nextCursor: '1000:msg_1'
		});
		expect(listChatPage).toHaveBeenCalledWith(player, null);
		expect(syncChat).not.toHaveBeenCalled();
	});

	it('refuse une synchronisation sans curseur', async () => {
		const response = await call(player, { after: '' });

		expect(response.status).toBe(400);
		expect(syncChat).not.toHaveBeenCalled();
	});

	it('rend la page précédente du plus récent au plus ancien', async () => {
		const messages = [view('msg_2', 2_000), view('msg_1', 1_000)];
		vi.mocked(listChatPage).mockReturnValue({
			messages,
			nextCursor: '1000:msg_1'
		});

		const response = await call(player, { before: '2000:msg_3' });

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual({
			messages,
			nextCursor: '1000:msg_1'
		});
		expect(listChatPage).toHaveBeenCalledWith(player, '2000:msg_3');
		expect(syncChat).not.toHaveBeenCalled();
	});

	it('rend la synchronisation demandée', async () => {
		const page = {
			messages: [view('msg_9', 9_000)],
			deletedIds: ['msg_2'],
			reset: false,
			polls: [{ id: 'msg_poll', poll: null }],
			nextAfter: null,
			hasMore: false,
			now: 9_500
		};
		vi.mocked(syncChat).mockReturnValue(page);

		const response = await call(player, {
			after: '8000:msg_8',
			deletedSince: '7000'
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual(page);
		expect(syncChat).toHaveBeenCalledWith(player, {
			after: '8000:msg_8',
			deletedSince: 7_000
		});
	});

	it('transmet l’absence d’instant de suppression', async () => {
		vi.mocked(syncChat).mockReturnValue({
			messages: [],
			deletedIds: [],
			reset: false,
			polls: [],
			nextAfter: null,
			hasMore: false,
			now: 9_500
		});

		const response = await call(player, { after: '8000:msg_8', deletedSince: '' });

		expect(response.status).toBe(200);
		expect(syncChat).toHaveBeenCalledWith(player, {
			after: '8000:msg_8',
			deletedSince: null
		});
	});

	it('transporte la remise à zéro demandée par le service', async () => {
		vi.mocked(syncChat).mockReturnValue({
			messages: [],
			deletedIds: [],
			reset: true,
			polls: [],
			nextAfter: null,
			hasMore: false,
			now: 9_500
		});

		const response = await call(player, { after: '8000:msg_8', deletedSince: '7000' });

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ reset: true });
	});

	it('refuse les lectures au-delà du seau du membre', async () => {
		const flood: Actor = { ...player, userId: 'flood' };
		const limit = ABUSE_LIMITS.chatRead;
		let allowed = 0;
		for (let attempt = 0; attempt < limit.limit; attempt += 1) {
			if (consumeAttempt(`chat-read:${flood.userId}`, limit.limit, limit.windowMs)) {
				allowed += 1;
			}
		}
		expect(allowed).toBe(limit.limit);

		const response = await call(flood, { after: '1000:msg_1' });

		expect(response.status).toBe(429);
		expect(syncChat).not.toHaveBeenCalled();
	});
});
