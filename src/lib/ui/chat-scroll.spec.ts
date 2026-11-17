import { describe, expect, it } from 'vitest';
import { initialPillState, nextPillState } from './chat-scroll.ts';

describe('pastille du clavardage', () => {
	it('n’annonce rien au premier rendu, même en haut de la page', () => {
		const state = initialPillState(50);

		expect(nextPillState(state, 50, false)).toBe(state);
		expect(state.newMessages).toBe(0);
	});

	it('compte un message arrivé pendant que le lecteur est remonté', () => {
		const state = initialPillState(50);

		expect(nextPillState(state, 51, false).newMessages).toBe(1);
	});

	it('ne compte pas un message arrivé quand le lecteur est en bas', () => {
		expect(nextPillState(initialPillState(50), 51, true).newMessages).toBe(0);
	});

	it('additionne les messages arrivés depuis la dernière lecture', () => {
		const state = { previousCount: 50, newMessages: 1 };

		expect(nextPillState(state, 53, false).newMessages).toBe(4);
	});

	it('ajuste le compteur quand l’historique rétrécit', () => {
		const state = nextPillState(initialPillState(50), 51, false);

		expect(nextPillState(state, 49, false)).toEqual({
			previousCount: 49,
			newMessages: 1
		});
	});
});
