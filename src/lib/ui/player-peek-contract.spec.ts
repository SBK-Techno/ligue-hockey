import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Avatar from './Avatar.svelte';
import LineupBoard from './match/LineupBoard.svelte';

const player = {
	playerId: 'player-1',
	fullName: 'Remplaçant Test',
	position: 'forward' as const,
	jerseyNumber: 15,
	avatarId: null,
	kind: 'regular' as const
};

const avatarPlayer = { fullName: player.fullName, userId: player.playerId, avatarId: null };

function buttonAround(body: string, name: string): string {
	const at = body.indexOf(name);
	const start = body.lastIndexOf('<button', at);
	const end = body.indexOf('>', start) + 1;
	return body.slice(start, end);
}

function board(canEdit: boolean): string {
	return render(LineupBoard, {
		props: { slots: [], bench: [player], canEdit, expectedGeneratedAt: null }
	}).body;
}

describe('contrat du déclencheur de la fiche joueur', () => {
	it('ne marque pas un avatar décoratif, qui reste une image', () => {
		const { body } = render(Avatar, { props: { player: avatarPlayer } });

		expect(body).not.toContain('data-player-id');
		expect(body).not.toContain('data-player-peek');
		expect(body).not.toContain('aria-haspopup');
	});

	it('déclare un avatar exposé avec la même cible annoncée que le nom', () => {
		const { body } = render(Avatar, { props: { player: avatarPlayer, decorative: false } });

		expect(body).toContain('data-player-id="player-1"');
		expect(body).toContain('data-player-peek="click"');
		expect(body).toContain('aria-haspopup="dialog"');
		expect(body).toContain('aria-expanded="false"');
	});

	it('garde un jeton de banc lisible comme déclencheur annoncé', () => {
		const chip = buttonAround(board(false), player.fullName);

		expect(chip).toContain('data-player-id="player-1"');
		expect(chip).toContain('data-player-peek="click"');
		expect(chip).toContain('aria-haspopup="dialog"');
		expect(chip).toContain('aria-expanded="false"');
	});

	it('garde la sélection du mode édition sans dialogue', () => {
		const chip = buttonAround(board(true), player.fullName);

		expect(chip).toContain('data-player-id="player-1"');
		expect(chip).not.toContain('data-player-peek');
		expect(chip).not.toContain('aria-haspopup');
		expect(chip).toContain('aria-pressed');
	});

	it('n’arme que le marqueur déclaré, jamais l’identifiant seul', () => {
		const installer = readFileSync('src/lib/ui/player-peek.svelte.ts', 'utf8');

		expect(installer).toContain("closest<HTMLElement>('[data-player-peek]')");
		expect(installer).not.toContain("closest<HTMLElement>('[data-player-id]')");
	});
});
