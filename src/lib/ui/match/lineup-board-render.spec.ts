import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
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
		const labels = [
			...body.matchAll(/<button[^>]*aria-label="([^"]*)"[^>]*>/g)
		].map((match) => match[1]);

		expect(labels).toHaveLength(38);
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
		expect(block).toContain('hyphens: manual');
		expect(block).toContain('overflow-wrap: normal');
		expect(block).toContain('white-space: normal');
		expect(block).not.toContain('text-overflow: ellipsis');
		expect(block).not.toContain('white-space: nowrap');
	});

	it('garde la formation exacte et compacte seulement les pastilles étroites', () => {
		const css = readFileSync('src/routes/layout.css', 'utf8');
		const team = css.slice(css.indexOf('.rink-team {'), css.indexOf('.rink-roster'));
		expect(team).toContain('container-type: inline-size');

		const start = css.indexOf('@container (max-width: 439px)');
		const compact = css.slice(start, css.indexOf('.avatar-picker', start));
		expect(start).toBeGreaterThan(0);
		expect(compact).toContain('--rink-face-size: 2.75rem');
		expect(compact).toContain('.rink-name');
		expect(compact).toContain('display: none');
		expect(css).not.toContain('@container (max-width: 559px)');
		expect(css).not.toContain('aspect-ratio: 4 / 3');
	});

	it('ne met deux glaces côte à côte que si chacune garde sa largeur', () => {
		const css = readFileSync('src/routes/layout.css', 'utf8');
		const teams = css.slice(css.indexOf('.rink-teams {'), css.indexOf('.rink-team {'));

		expect(teams).toContain(
			'grid-template-columns: repeat(auto-fit, minmax(min(100%, 28rem), 1fr))'
		);
	});

	it('découpe le portrait, jamais le numéro ni le nom', () => {
		const { body } = render(LineupBoard, {
			props: { slots: fullSlots, bench, canEdit: false, expectedGeneratedAt: 123 }
		});
		const token =
			body.match(/<button[^>]*data-player-id="white-forward-0"[^>]*>[\s\S]*?<\/button>/)?.[0] ??
			'';

		expect(token).toContain('<span class="rink-face">');
		expect(token).toContain('<span class="rink-number">');
		expect(token).toContain('<span class="rink-name">');

		const css = readFileSync('src/routes/layout.css', 'utf8');
		const tokenRule = css.slice(
			css.indexOf('.rink-token {'),
			css.indexOf('.rink-token:focus-visible')
		);
		const portraitRule = css.slice(
			css.indexOf('.rink-portrait {'),
			css.indexOf(".rink-token[data-team='white']")
		);
		expect(tokenRule).not.toContain('overflow: hidden');
		expect(portraitRule).toContain('overflow: hidden');
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

	it('affiche un portrait par joueur et une seule ligne d’aide', () => {
		const { body } = render(LineupBoard, {
			props: { slots: fullSlots, bench, canEdit: true, expectedGeneratedAt: 123 }
		});

		expect((body.match(/class="rink-portrait"/g) ?? []).length).toBe(34);
		expect((body.match(/class="bench-portrait"/g) ?? []).length).toBe(3);
		expect((body.match(/rink-roster/g) ?? []).length).toBe(1);
		expect(body).toMatch(/background-image: url\(\/identities\/identities-[0-9a-f]{12}\.webp\)/);
		for (const avatarId of Object.values(knownAvatars)) {
			expect(body, avatarId).toContain(identitySheetStyle(avatarId));
		}
		expect(identitySheetStyle(knownAvatars['white-forward-0']!)).not.toBe(
			identitySheetStyle(knownAvatars['black-forward-0']!)
		);
		expect(body).toContain(t('rink.helpManager'));
		expect(body).toContain(t('rink.undo'));
		expect(body).toContain('data-bench-drop="true"');

		const keys = [...body.matchAll(/data-lineup-key="([^"]*)"/g)].map((match) => match[1]);
		expect(keys).toHaveLength(38);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it('marque le joueur connecté, son poste et la position de chaque jeton', () => {
		const { body } = render(LineupBoard, {
			props: {
				slots: fullSlots,
				bench,
				canEdit: false,
				expectedGeneratedAt: 123,
				actorId: 'white-forward-0',
				ownTeam: 'white'
			}
		});
		const token =
			body.match(/<button[^>]*data-player-id="white-forward-0"[^>]*>/)?.[0] ?? '';

		expect(token).toContain('data-you="true"');
		expect(token).toMatch(new RegExp(`, ${t('common.you')}"`));
		expect(body).toContain(t('rink.yourSpot'));
		expect(body).toContain(t('team.white'));
		expect(body).toContain(t('position.forward'));
		expect(body).toContain(t('rink.line', { line: 1 }));
		expect(body).not.toContain('class="rink-role"');
		const row =
			body.match(
				/<li class="ledger-row[^"]*"[^>]*data-you="true"[^>]*>([\s\S]*?)<\/li>/
			)?.[1] ?? '';
		expect(row).toContain('white-forward-0 Test');
		expect(row).toContain(t('common.you'));
	});

	it('place le joueur du banc et son marqueur « Toi » sur la carte', () => {
		const { body } = render(LineupBoard, {
			props: {
				slots: fullSlots,
				bench,
				canEdit: false,
				expectedGeneratedAt: 123,
				actorId: 'bench-1'
			}
		});
		const chip =
			body.match(/<button[^>]*data-player-id="bench-1"[^>]*>/)?.[0] ?? '';

		expect(body).toContain(t('home.teamBench'));
		expect(body).toContain(t('home.teamBenchHelp'));
		expect(chip).toContain('data-you="true"');
		expect(chip).toContain(t('common.you'));
	});

	it('dit franchement qu’un joueur n’est pas dans la formation publiée', () => {
		const { body } = render(LineupBoard, {
			props: {
				slots: fullSlots,
				bench,
				canEdit: false,
				expectedGeneratedAt: 123,
				actorId: 'absent'
			}
		});

		expect(body).toContain(t('home.teamNoSlot'));
		expect(body).toContain(t('home.teamNoSlotHelp'));
		expect(body).not.toContain(t('rink.yourSpot'));
	});

	it('ouvre la carte sur l’équipe du joueur et garde l’autre derrière le commutateur', () => {
		const { body } = render(LineupBoard, {
			props: {
				slots: fullSlots,
				bench,
				canEdit: false,
				expectedGeneratedAt: 123,
				actorId: 'black-forward-0',
				ownTeam: 'black'
			}
		});
		const start = body.indexOf('class="rink-switch"');
		const switcher = body.slice(start, body.indexOf('</div>', start));
		const first = switcher.indexOf(t('team.black.short'));
		const second = switcher.indexOf(t('team.white.short'));

		expect(first).toBeGreaterThan(-1);
		expect(second).toBeGreaterThan(first);
		expect(switcher).toContain('aria-pressed="true"');
		expect(switcher).toContain('aria-controls="rink-team-black"');
		expect(switcher).toContain('aria-controls="rink-team-white"');
		expect(body).toContain('id="rink-team-black" data-active="true"');
		expect(body).toContain('id="rink-team-white" data-active="false"');
	});

	it('masque l’aide du gérant et la cible du banc en lecture seule', () => {
		const { body } = render(LineupBoard, {
			props: { slots: fullSlots, bench, canEdit: false, expectedGeneratedAt: 123 }
		});

		expect(body).not.toContain(t('rink.helpManager'));
		expect(body).toContain(t('rink.helpPlayer'));
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
