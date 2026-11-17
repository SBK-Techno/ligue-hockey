import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { initialPillState, nextPillState } from './chat-scroll.ts';
import ChatNewMessages from './ChatNewMessages.svelte';

function statusText(body: string): string | null {
	return body.match(/<p class="sr-only" role="status">([^<]*)<\/p>/)?.[1] ?? null;
}

describe('avis de nouveaux messages', () => {
	it('garde une région polie vide avant tout message', () => {
		const { body } = render(ChatNewMessages, {
			props: { count: 0, onshow: () => {} }
		});

		expect(body.match(/role="status"/g)).toHaveLength(1);
		expect(statusText(body)).toBe('');
		expect(body).not.toContain('<button');
	});

	it('annonce le nombre de messages arrivés une seule fois', () => {
		const { body } = render(ChatNewMessages, {
			props: { count: 2, onshow: () => {} }
		});

		expect(body.match(/role="status"/g)).toHaveLength(1);
		expect(statusText(body)).toContain('2');
		expect(body.match(/2 nouveaux messages/g)).toHaveLength(2);
	});

	it('annonce le compte produit par un rafraîchissement', () => {
		const list = (count: number) =>
			Array.from({ length: count }, (_, index) => ({
				id: `msg_${index + 1}`,
				createdAt: index + 1
			}));
		const state = nextPillState(initialPillState(list(10)), list(12), false);
		const { body } = render(ChatNewMessages, {
			props: { count: state.newMessages, onshow: () => {} }
		});

		expect(statusText(body)).toBe('2 nouveaux messages');
		expect(body.match(/role="status"/g)).toHaveLength(1);
	});
});
