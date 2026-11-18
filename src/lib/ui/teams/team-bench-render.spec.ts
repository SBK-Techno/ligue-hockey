import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
import { t } from '#lib/shared/i18n/index.ts';
import TeamBench from './TeamBench.svelte';
import TeamBoard from './TeamBoard.svelte';

function player(id: string, team: GamePlayer['team'] = null): GamePlayer {
	return {
		playerId: id,
		fullName: `${id} Test`,
		position: 'forward',
		jerseyNumber: 1,
		avatarId: null,
		kind: 'regular',
		team
	};
}

const slots: GameSlotView[] = [
	{ team: 'white', position: 'forward', slotIndex: 0, player: player('ice-white') },
	{ team: 'black', position: 'forward', slotIndex: 0, player: player('ice-black') }
];

const bench: GamePlayer[] = [
	player('bench-w1', 'white'),
	player('bench-w2', 'white'),
	player('bench-b1', 'black'),
	player('bench-x1')
];

describe('banc en lecture seule', () => {
	it('groupe le banc par équipe et nomme les joueurs hors effectif', () => {
		const { body } = render(TeamBench, { props: { bench } });

		expect(body).toContain('data-team="white"');
		expect(body).toContain('data-team="black"');
		expect(body).toContain('data-overflow="true"');
		expect(body).toContain(`${t('team.white')} · 2`);
		expect(body).toContain(`${t('team.black')} · 1`);
		expect(body).toContain(`${t('rink.benchOverflow')} · 1`);
		expect(body).toContain('bench-x1');
	});

	it('ne rend rien sans banc', () => {
		const { body } = render(TeamBench, { props: { bench: [] } });

		expect(body).not.toContain(t('rink.bench'));
	});

	it('marque le joueur connecté sur le banc', () => {
		const { body } = render(TeamBench, { props: { bench, actorId: 'bench-w1' } });
		const chip = body.match(/<li[^>]*data-you="true"[^>]*>[\s\S]*?<\/li>/)?.[0] ?? '';

		expect(chip).toContain('bench-w1');
		expect(chip).toContain(t('common.you'));
	});
});

describe('effectif habillé sur la fiche d’équipe', () => {
	it('compte la glace plus le banc de chaque équipe', () => {
		const { body } = render(TeamBoard, { props: { slots, bench } });

		expect(body).toContain('3 joueurs');
		expect(body).toContain('2 joueurs');
	});

	it('compte seulement la glace sans banc habillé', () => {
		const { body } = render(TeamBoard, { props: { slots, bench: [] } });

		expect(body).toContain('1 joueur');
		expect(body).not.toContain(t('rink.bench'));
	});
});