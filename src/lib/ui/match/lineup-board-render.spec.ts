import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
import AvatarPicker from '#lib/ui/AvatarPicker.svelte';
import { identitySheetStyle } from '#lib/ui/identity-display.ts';
import LineupBoard from './LineupBoard.svelte';

const knownAvatars: Record<string, string> = {
	'white-forward-0': 'legende-lafleur',
	'black-forward-0': 'capitaine-navy'
};

function player(id: string, avatarId: string | null = null): GamePlayer {
	return {
		playerId: id,
		fullName: `${id} Test`,
		position: 'forward',
		jerseyNumber: Number(id.replace(/\D/g, '')) || 1,
		avatarId,
		kind: 'regular'
	};
}

function slot(
	team: GameSlotView['team'],
	position: GameSlotView['position'],
	slotIndex: number,
	filled: boolean
): GameSlotView {
	const playerId = `${team}-${position}-${slotIndex}`;
	return {
		team,
		position,
		slotIndex,
		player: filled ? player(playerId, knownAvatars[playerId] ?? null) : null
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

	it('garde le nom de famille entier dans le jeton, sans coupure insérée', () => {
		const slots = fullSlots.map((slot) =>
			slot.player?.playerId === 'white-forward-0'
				? { ...slot, player: { ...slot.player, fullName: 'Jean-Sébastien Rousseau' } }
				: slot
		);
		const { body } = render(LineupBoard, {
			props: { slots, bench, canEdit: false, expectedGeneratedAt: 123 }
		});
		const token = body.match(
			/<button[^>]*data-player-id="white-forward-0"[^>]*>[\s\S]*?<\/button>/
		)?.[0] ?? '';

		expect(token).toContain('<span class="rink-name">Rousseau</span>');
		expect(body).not.toContain('Rous\u00adseau');
		expect(body).not.toContain('Rous-seau');

		const css = readFileSync('src/routes/layout.css', 'utf8');
		const block = css.slice(css.indexOf('.rink-name {'), css.indexOf('.rink-empty'));
		expect(block).toContain('hyphens: none');
		expect(block).toContain('text-overflow: ellipsis');
		expect(block).toContain('white-space: nowrap');
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
		expect(body).not.toContain('aria-haspopup="dialog"');
	});

	it('affiche un portrait par joueur et le guide des trois gestes', () => {
		const { body } = render(LineupBoard, {
			props: { slots: fullSlots, bench, canEdit: true, expectedGeneratedAt: 123 }
		});

		expect((body.match(/class="identity-portrait"/g) ?? []).length).toBe(37);
		expect(body).toMatch(/background-image: url\(\/identities\/identities-[0-9a-f]{12}\.webp\)/);
		for (const avatarId of Object.values(knownAvatars)) {
			expect(body, avatarId).toContain(identitySheetStyle(avatarId));
		}
		expect(identitySheetStyle(knownAvatars['white-forward-0']!)).not.toBe(
			identitySheetStyle(knownAvatars['black-forward-0']!)
		);
		expect(body).toContain(t('rink.stepPick'));
		expect(body).toContain(t('rink.stepPlace'));
		expect(body).toContain(t('rink.stepSave'));
		expect(body).toContain(t('rink.stepActive'));
		expect(body).toContain(t('rink.stepTodo'));
		expect((body.match(/aria-current="step"/g) ?? []).length).toBe(1);
		expect(body).toContain(t('rink.undo'));
		expect(body).toContain('data-bench-drop="true"');

		const keys = [...body.matchAll(/data-lineup-key="([^"]*)"/g)].map((match) => match[1]);
		expect(keys).toHaveLength(38);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('masque le guide et la cible du banc en lecture seule', () => {
		const { body } = render(LineupBoard, {
			props: { slots: fullSlots, bench, canEdit: false, expectedGeneratedAt: 123 }
		});

		expect(body).not.toContain(t('rink.stepPick'));
		expect(body).not.toContain('data-bench-drop');
		expect(body).not.toContain(t('rink.undo'));
	});

	it('annonce une fiche de joueur sur le banc en lecture seule, pas une sélection', () => {
		const { body } = render(LineupBoard, {
			props: {
				slots: fullSlots,
				bench,
				canEdit: false,
				expectedGeneratedAt: 123
			}
		});
		const chip = body.match(/<button[^>]*data-player-id="bench-1"[^>]*>/)?.[0] ?? '';

		expect(chip).toContain('aria-haspopup="dialog"');
		expect(chip).toContain('aria-expanded="false"');
		expect(chip).not.toContain('aria-pressed');
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
