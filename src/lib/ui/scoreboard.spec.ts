import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { AvailabilityView } from '#lib/domain/availability/service.ts';
import type { GameView } from '#lib/domain/games/service.ts';
import type { GameSheetView } from '#lib/domain/gamesheet/types.ts';
import HomeHero from '#lib/ui/home/HomeHero.svelte';
import GameSheet from '#lib/ui/match/GameSheet.svelte';

const game: GameView = {
	id: 'game-1',
	gameDate: '2026-11-15',
	startTime: '08:30',
	locationId: 'loc-1',
	location: 'Complexe sportif de Sainte-Foy',
	status: 'scheduled',
	notes: null,
	locationAddress: null,
	locationMapUrl: null,
	slots: [],
	generation: null,
	completedAt: null,
	lineupManualAt: null,
	openSlots: 0,
	openSlotsLabel: '',
	lineupComplete: false,
	generated: false,
	updatedAt: 0
};

const sheet: GameSheetView = {
	gameId: 'game-1',
	goals: [],
	penalties: [],
	score: { white: 2, black: 1 },
	totals: [],
	finalized: false
};

const availability: AvailabilityView = {
	rows: [],
	pending: [],
	present: 0,
	absent: 0,
	unknown: 0,
	summary: '',
	own: null,
	locked: false,
	canRespond: true,
	canWithdraw: false,
	substitute: false,
	closesAtLabel: '15 novembre'
};

describe('ligne de centre du tableau', () => {
	it('garde les pastilles de présence à la largeur de leur libellé', () => {
		const { body } = render(HomeHero, {
			props: {
				variant: 'today',
				game,
				mapUrl: null,
				teamLabel: null,
				availability,
				ownSlot: null,
				ownBench: null,
				ownRequest: null,
				isSubstitute: false,
				isManager: false,
				hasGame: true
			}
		});
		const form = body.match(/<form[^>]*action="\?\/availability"[^>]*>/)?.[0] ?? '';
		const chips = [...body.matchAll(/<button[^>]*class="(chip chip-on-ink[^"]*)"[^>]*>/g)];

		expect(form).toContain('flex flex-wrap');
		expect(form).not.toContain('grid-cols-2');
		expect(chips).toHaveLength(2);
		for (const chip of chips) {
			expect(chip[1]).toContain('max-w-60');
			expect(chip[1]).not.toContain('w-full');
		}
	});

	it('ne coupe pas le prochain match de l’accueil', () => {
		const { body } = render(HomeHero, {
			props: {
				variant: 'today',
				game,
				mapUrl: null,
				teamLabel: null,
				availability: null,
				ownSlot: null,
				ownBench: null,
				ownRequest: null,
				isSubstitute: false,
				isManager: false,
				hasGame: true
			}
		});

		expect(body).toContain('class="scoreboard relative"');
		expect(body).not.toContain('scoreboard-split');
	});

	it('garde la ligne de centre explicite du score à deux colonnes', () => {
		const { body } = render(GameSheet, {
			props: { sheet, slots: [], canManage: false, completed: false }
		});

		expect(body.match(/h-8 w-px bg-paper\/25/g)).toHaveLength(1);
		expect(body).not.toContain('scoreboard-split');
	});
});
