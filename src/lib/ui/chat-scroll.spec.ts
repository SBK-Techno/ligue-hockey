import { describe, expect, it } from 'vitest';
import { initialPillState, nextPillState } from './chat-scroll.ts';

function messages(from: number, to: number) {
	return Array.from({ length: to - from + 1 }, (_, index) => ({
		id: `msg_${String(from + index).padStart(2, '0')}`,
		createdAt: from + index
	}));
}

describe('pastille du clavardage', () => {
	it('n’annonce rien au premier rendu, même en haut de la page', () => {
		const list = messages(1, 50);
		const state = initialPillState(list);

		expect(nextPillState(state, list, false)).toBe(state);
		expect(state.newMessages).toBe(0);
	});

	it('compte un message arrivé pendant que le lecteur est remonté', () => {
		const state = initialPillState(messages(1, 50));

		expect(nextPillState(state, messages(1, 51), false).newMessages).toBe(1);
	});

	it('ne compte pas un message arrivé quand le lecteur est en bas', () => {
		const state = initialPillState(messages(1, 50));

		expect(nextPillState(state, messages(1, 51), true).newMessages).toBe(0);
	});

	it('additionne les messages arrivés depuis la dernière lecture', () => {
		const state = nextPillState(initialPillState(messages(1, 50)), messages(1, 51), false);

		expect(nextPillState(state, messages(1, 53), false).newMessages).toBe(3);
	});

	it('ne compte jamais une page plus ancienne comme un nouveau message', () => {
		const state = initialPillState(messages(21, 40));

		const withOlder = messages(1, 40);
		expect(nextPillState(state, withOlder, false)).toBe(state);
		expect(withOlder.at(-1)?.id).toBe('msg_40');
	});

	it('voit un message neuf même quand la fenêtre garde le même nombre de lignes', () => {
		const state = initialPillState(messages(1, 20));

		// La fenêtre glisse d'un cran : le compte reste 20, le dernier change.
		expect(nextPillState(state, messages(2, 21), false).newMessages).toBe(1);
	});

	it('acquitte tout quand le lecteur revient en bas', () => {
		const state = nextPillState(initialPillState(messages(1, 50)), messages(1, 53), false);

		const cleared = nextPillState(state, messages(1, 53), true);
		expect(cleared.newMessages).toBe(0);
		expect(cleared.newestId).toBe('msg_53');
	});

	it('garde le dernier message lu quand l’historique rétrécit', () => {
		const state = nextPillState(initialPillState(messages(1, 50)), messages(1, 51), false);

		const shrunk = nextPillState(state, messages(1, 49), false);
		expect(shrunk.newMessages).toBe(0);
		expect(shrunk.newestId).toBe('msg_50');
	});
});
