// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GamePlayer, GameSlotView } from '#lib/domain/games/types.ts';
import { t } from '#lib/shared/i18n/index.ts';
import LineupBoard from './LineupBoard.svelte';

vi.mock('#lib/ui/progressive-form.ts', () => ({
	progressiveForm: () => ({})
}));

type Component = ReturnType<typeof mount>;

let component: Component | undefined;
let dropTarget: Element | null = null;

function player(
	id: string,
	fullName: string,
	jerseyNumber: number,
	position: GamePlayer['position'] = 'forward'
): GamePlayer {
	return {
		playerId: id,
		fullName,
		position,
		jerseyNumber,
		avatarId: 'capitaine-navy',
		kind: 'regular'
	};
}

function slot(
	team: GameSlotView['team'],
	position: GameSlotView['position'],
	slotIndex: number,
	filled: GamePlayer | null
): GameSlotView {
	return { team, position, slotIndex, player: filled };
}

function token(key: string): HTMLElement {
	const node = document.querySelector<HTMLElement>(`[data-lineup-key="${key}"]`);
	if (!node) throw new Error(`cible absente: ${key}`);
	return node;
}

function fire(node: Element, type: string, x: number, y: number) {
	const event = new MouseEvent(type, {
		bubbles: true,
		cancelable: true,
		button: 0,
		clientX: x,
		clientY: y
	});
	Object.defineProperty(event, 'pointerId', { value: 1 });
	node.dispatchEvent(event);
	flushSync();
}

function fireTouch(node: Element, type: string, x: number, y: number) {
	const event = new MouseEvent(type, {
		bubbles: true,
		cancelable: true,
		button: 0,
		clientX: x,
		clientY: y
	});
	Object.defineProperty(event, 'pointerId', { value: 2 });
	Object.defineProperty(event, 'pointerType', { value: 'touch' });
	node.dispatchEvent(event);
	flushSync();
}

function drag(from: Element, to: Element) {
	dropTarget = to;
	fire(from, 'pointerdown', 10, 10);
	fire(from, 'pointermove', 40, 40);
	fire(from, 'pointerup', 40, 40);
	dropTarget = null;
}

function tap(node: Element) {
	dropTarget = node;
	fire(node, 'pointerdown', 10, 10);
	fire(node, 'pointerup', 10, 10);
	dropTarget = null;
}

function button(label: string): HTMLButtonElement {
	const node = [...document.querySelectorAll('button')].find(
		(candidate) => candidate.textContent?.trim() === label
	);
	if (!node) throw new Error(`bouton absent: ${label}`);
	return node as HTMLButtonElement;
}

function hasButton(label: string): boolean {
	return [...document.querySelectorAll('button')].some(
		(candidate) => candidate.textContent?.trim() === label
	);
}

beforeEach(() => {
	Object.defineProperty(Element.prototype, 'setPointerCapture', {
		configurable: true,
		value: () => {}
	});
	Object.defineProperty(Element.prototype, 'releasePointerCapture', {
		configurable: true,
		value: () => {}
	});
	Object.defineProperty(Element.prototype, 'hasPointerCapture', {
		configurable: true,
		value: () => false
	});
	Object.defineProperty(document, 'elementFromPoint', {
		configurable: true,
		value: () => dropTarget
	});

	const slots = [
		slot('white', 'forward', 0, player('a', 'Alice Roy', 1)),
		slot('white', 'forward', 1, null),
		slot('black', 'forward', 0, null),
		slot('black', 'defense', 0, null),
		slot('black', 'goalie', 0, null)
	];
	const bench = [
		player('b', 'Bob Gagnon', 27),
		player('g', 'Guy Gagnon', 30, 'goalie')
	];

	const target = document.createElement('div');
	document.body.append(target);
	component = mount(LineupBoard, {
		target,
		props: { slots, bench, canEdit: true, expectedGeneratedAt: 1 }
	});
	flushSync();
});

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	document.body.innerHTML = '';
	dropTarget = null;
});

describe('gestes de la carte', () => {
	it('glisse un joueur de la glace vers une place vide', () => {
		drag(token('white:forward:0'), token('white:forward:1'));

		expect(token('white:forward:0').dataset.filled).toBe('false');
		expect(token('white:forward:1').dataset.filled).toBe('true');
		expect(token('white:forward:1').textContent).toContain('Roy');
		expect(button(t('rink.save')).disabled).toBe(false);
		expect(hasButton(t('rink.reset'))).toBe(true);
	});

	it('touche un joueur puis une place pour le déplacer', () => {
		tap(token('white:forward:0'));
		expect(token('white:forward:0').dataset.selected).toBe('true');
		expect(token('white:forward:1').dataset.awaiting).toBe('true');
		expect(document.body.textContent).toContain('Alice Roy');
		expect(button(t('rink.save')).disabled).toBe(true);

		tap(token('white:forward:1'));
		expect(token('white:forward:0').dataset.filled).toBe('false');
		expect(token('white:forward:1').textContent).toContain('Roy');
		expect(button(t('rink.save')).disabled).toBe(false);
	});

	it('glisse un joueur du banc vers la glace', () => {
		drag(token('bench:b'), token('white:forward:1'));

		expect(token('white:forward:1').textContent).toContain('Gagnon');
		expect(document.querySelector('[data-lineup-key="bench:b"]')).toBeNull();
		expect(button(t('rink.save')).disabled).toBe(false);
	});

	it('dépose un joueur sur le banc pour le retirer de la glace', () => {
		const bench = document.querySelector('[data-bench-drop]');
		if (!bench) throw new Error('zone du banc absente');

		drag(token('white:forward:0'), bench);

		expect(token('white:forward:0').dataset.filled).toBe('false');
		expect(document.querySelector('[data-lineup-key="bench:a"]')).not.toBeNull();
	});

	it('annule le dernier geste depuis le bouton', () => {
		drag(token('white:forward:0'), token('white:forward:1'));
		expect(token('white:forward:1').dataset.filled).toBe('true');

		button(t('rink.undo')).click();
		flushSync();

		expect(token('white:forward:0').dataset.filled).toBe('true');
		expect(token('white:forward:1').dataset.filled).toBe('false');
		expect(button(t('rink.save')).disabled).toBe(true);
		expect(hasButton(t('rink.reset'))).toBe(false);
	});

	it('laisse la sélection en place quand le dépôt est annulé', () => {
		tap(token('white:forward:0'));
		dropTarget = null;
		fire(token('white:forward:0'), 'pointerdown', 10, 10);
		fire(token('white:forward:0'), 'pointermove', 40, 40);
		fire(token('white:forward:0'), 'pointerup', 40, 40);

		expect(token('white:forward:0').dataset.selected).toBe('true');
	});

	it('change d’équipe avec le commutateur sans toucher à la formation', () => {
		const black = document.querySelector<HTMLButtonElement>(
			'button[aria-controls="rink-team-black"]'
		);
		expect(black).not.toBeNull();
		expect(black!.getAttribute('aria-pressed')).toBe('false');

		black!.click();
		flushSync();

		expect(black!.getAttribute('aria-pressed')).toBe('true');
		expect(document.querySelector('#rink-team-black')?.getAttribute('data-active')).toBe(
			'true'
		);
		expect(document.querySelector('#rink-team-white')?.getAttribute('data-active')).toBe(
			'false'
		);
		expect(token('white:forward:0').getAttribute('data-filled')).toBe('true');
	});

	it('ne déplace pas un joueur pendant un défilement tactile', () => {
		dropTarget = token('white:forward:1');
		fireTouch(token('white:forward:0'), 'pointerdown', 10, 10);
		fireTouch(token('white:forward:0'), 'pointermove', 10, 90);
		fireTouch(token('white:forward:0'), 'pointerup', 10, 90);

		expect(token('white:forward:0').dataset.filled).toBe('true');
		expect(token('white:forward:1').dataset.filled).toBe('false');
		expect(token('white:forward:0').dataset.selected).toBe('false');
	});

	it('sélectionne un joueur au toucher sans glisser', () => {
		fireTouch(token('white:forward:0'), 'pointerdown', 10, 10);
		fireTouch(token('white:forward:0'), 'pointerup', 10, 10);

		expect(token('white:forward:0').dataset.selected).toBe('true');
	});

	it('refuse de placer le gardien hors de sa place', () => {
		tap(token('bench:g'));

		expect(token('black:defense:0').dataset.ineligible).toBe('true');
		expect(token('black:defense:0').hasAttribute('disabled')).toBe(true);
		expect(token('black:goalie:0').dataset.ineligible).toBe('false');
		expect(token('black:goalie:0').hasAttribute('disabled')).toBe(false);
		expect(document.body.textContent).toContain(
			t('rink.positionOnly', { position: t('position.goalie') })
		);

		drag(token('bench:g'), token('black:defense:0'));

		expect(token('black:defense:0').dataset.filled).toBe('false');
		expect(document.querySelector('[data-lineup-key="bench:g"]')).not.toBeNull();

		tap(token('black:goalie:0'));

		expect(token('black:goalie:0').dataset.filled).toBe('true');
		expect(token('black:goalie:0').textContent).toContain('Gagnon');
	});
});
