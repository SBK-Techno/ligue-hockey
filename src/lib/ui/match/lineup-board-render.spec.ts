import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
import AvatarPicker from '#lib/ui/AvatarPicker.svelte';
import LineupBoard from './LineupBoard.svelte';

function player(id: string): GamePlayer {
	return {
		playerId: id,
		fullName: `${id} Test`,
		position: 'forward',
		jerseyNumber: Number(id.replace(/\D/g, '')) || 1,
		avatarId: null,
		kind: 'regular'
	};
}

function slot(
	team: GameSlotView['team'],
	position: GameSlotView['position'],
	slotIndex: number,
	filled: boolean
): GameSlotView {
	return {
		team,
		position,
		slotIndex,
		player: filled ? player(`${team}-${position}-${slotIndex}`) : null
	};
}

const fullSlots: GameSlotView[] = [
	...Array.from({ length: 8 }, (_, index) => slot('white', 'forward', index, true)),
	...Array.from({ length: 8 }, (_, index) => slot('white', 'defense', index, true)),
	slot('white', 'goalie', 0, true),
	slot('white', 'goalie', 1, false),
	...Array.from({ length: 8 }, (_, index) => slot('black', 'forward', index, true)),
	...Array.from({ length: 8 }, (_, index) => slot('black', 'defense', index, true)),
	slot('black', 'goalie', 0, true),
	slot('black', 'goalie', 1, true)
];

const bench: GamePlayer[] = [
	{ ...player('bench-1'), position: 'defense' },
	{ ...player('bench-2'), position: 'goalie' }
];

describe('rendu de la carte d’alignement', () => {
	it('nomme chaque place d’un effectif complet sans collision', () => {
		const { body } = render(LineupBoard, {
			props: {
				slots: fullSlots,
				bench,
				canEdit: true,
				expectedGeneratedAt: 123
			}
		});
		const labels = [...body.matchAll(/aria-label="([^"]*)"/g)].map(
			(match) => match[1]
		);

		expect(labels).toHaveLength(36);
		expect(new Set(labels).size).toBe(labels.length);
		expect(labels.some((label) => label.includes(t('rink.emptySlot')))).toBe(true);
		expect(body).toContain(t('rink.bench'));
		expect(body).toContain(t('team.white'));
		expect(body).toContain(t('team.black'));
	});

	it('donne à chaque jeton rempli un nom qui contient son texte visible', () => {
		const { body } = render(LineupBoard, {
			props: {
				slots: fullSlots,
				bench,
				canEdit: false,
				expectedGeneratedAt: 123
			}
		});
		const tokens = [
			...body.matchAll(/<button[^>]*class="rink-token"[^>]*>([\s\S]*?)<\/button>/g)
		].filter((match) => match[0].includes('data-filled="true"'));

		expect(tokens).toHaveLength(34);
		for (const token of tokens) {
			const label = token[0].match(/aria-label="([^"]*)"/)?.[1] ?? '';
			const jersey = token[1].match(/class="rink-number">([^<]*)</)?.[1].trim() ?? '';
			const surname = token[1].match(/class="rink-name">([^<]*)</)?.[1].trim() ?? '';
			const visible = `${jersey} ${surname}`;
			expect(visible, token[0]).not.toBe(' ');
			expect(label, visible).toContain(visible);
		}
	});

	it('rend les joueurs du banc comme des boutons non sélectionnés', () => {
		const { body } = render(LineupBoard, {
			props: {
				slots: fullSlots,
				bench,
				canEdit: true,
				expectedGeneratedAt: 123
			}
		});

		expect(body).toContain('data-player-id="bench-1"');
		expect(body).toContain('aria-pressed="false"');
	});
});

describe('rendu du sélecteur d’identité', () => {
	it('garde une légende enregistrée hors poste, visible et signalée', () => {
		const { body } = render(AvatarPicker, {
			props: { selected: 'legende-roy', position: 'forward' }
		});

		expect(body).toContain('value="legende-roy"');
		expect(body).toContain(t('profile.legendMismatch'));
		expect(body.match(new RegExp(t('profile.legendMismatch'), 'g'))).toHaveLength(1);
		// Une légende d'un autre poste et non sélectionnée reste hors de la liste.
		expect(body).not.toContain('value="legende-harvey"');
	});

	it('ne signale aucun décalage quand la légende correspond au poste', () => {
		const { body } = render(AvatarPicker, {
			props: { selected: 'legende-roy', position: 'goalie' }
		});

		expect(body).toContain('value="legende-roy"');
		expect(body).not.toContain(t('profile.legendMismatch'));
	});
});
