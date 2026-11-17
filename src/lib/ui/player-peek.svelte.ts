import type { PlayerPeekView } from '#lib/domain/players/peek.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { PLAYER_PEEK_EVENT } from './events.ts';
import type { PeekAnchor } from './player-peek.ts';
import {
	clearPeekCache,
	readPeekCache,
	writePeekCache,
	type PeekCache
} from './player-peek-cache.ts';

const CACHE_TTL_MS = 30_000;
const OPEN_DELAY_MS = 220;
const CLOSE_DELAY_MS = 160;

type Status = 'idle' | 'loading' | 'ready' | 'error';

let openId = $state<string | null>(null);
let anchor = $state<PeekAnchor | null>(null);
let view = $state<PlayerPeekView | null>(null);
let status = $state<Status>('idle');
let pinned = $state(false);
let triggerElement: HTMLElement | null = null;

let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;
// La portée vient de la capacité serveur; elle change avec le rôle ou la
// session et vide le cache avant qu'une fiche puisse être resservie.
let cacheScope = 'public';
const cache: PeekCache<PlayerPeekView> = {};

export function setPlayerPeekScope(scope: string): void {
	if (scope === cacheScope) return;
	cacheScope = scope;
	clearPeekCache(cache);
	if (openId) closePlayerPeek();
}

function clearTimers(): void {
	if (openTimer) clearTimeout(openTimer);
	if (closeTimer) clearTimeout(closeTimer);
	openTimer = null;
	closeTimer = null;
}

function anchorOf(element: HTMLElement): PeekAnchor {
	const rect = element.getBoundingClientRect();
	return {
		top: rect.top,
		left: rect.left,
		width: rect.width,
		height: rect.height,
		bottom: rect.bottom,
		right: rect.right
	};
}

/**
 * L'état du déclencheur suit l'état réel de la fiche. Une seule fonction
 * écrit l'attribut, pour que l'ouverture, le changement de joueur et la
 * fermeture ne puissent pas diverger.
 */
export function syncTriggerExpanded(
	element: Pick<HTMLElement, 'setAttribute'>,
	openId: string | null,
	playerId: string
): void {
	element.setAttribute('aria-expanded', openId === playerId ? 'true' : 'false');
}

async function load(playerId: string): Promise<void> {
	controller?.abort();
	const current = new AbortController();
	controller = current;
	const requestScope = cacheScope;
	try {
		const response = await fetch(
			`/api/joueurs/${encodeURIComponent(playerId)}`,
			{ signal: current.signal, headers: { accept: 'application/json' } }
		);
		if (!response.ok) throw new Error(`peek ${response.status}`);
		const data = (await response.json()) as PlayerPeekView;
		// Une réponse demandée avant un changement de capacité n'entre jamais
		// dans la portée suivante.
		if (requestScope !== cacheScope) return;
		writePeekCache(cache, requestScope, playerId, data, clock.nowMs());
		if (openId === playerId) {
			view = data;
			status = 'ready';
		}
	} catch (cause) {
		if ((cause as Error).name === 'AbortError') return;
		if (openId === playerId) status = 'error';
	}
}

export function openPlayerPeek(
	playerId: string,
	element: HTMLElement,
	options: { pinned?: boolean } = {}
): void {
	clearTimers();
	if (triggerElement && triggerElement !== element) {
		syncTriggerExpanded(triggerElement, null, triggerElement.dataset.playerId ?? '');
	}
	triggerElement = element;
	anchor = anchorOf(element);
	if (openId === playerId) {
		if (options.pinned) pinned = true;
		syncTriggerExpanded(element, playerId, playerId);
		return;
	}
	controller?.abort();
	openId = playerId;
	pinned = options.pinned ?? false;
	syncTriggerExpanded(element, playerId, playerId);
	// La coquille charge la carte à la première ouverture, pas avant.
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent(PLAYER_PEEK_EVENT));
	}
	const cached = readPeekCache(cache, cacheScope, playerId, clock.nowMs(), CACHE_TTL_MS);
	if (cached) {
		view = cached;
		status = 'ready';
		return;
	}
	view = null;
	status = 'loading';
	void load(playerId);
}

export function schedulePlayerPeekOpen(
	playerId: string,
	element: HTMLElement
): void {
	if (openId === playerId) return;
	clearTimers();
	openTimer = setTimeout(() => {
		openTimer = null;
		openPlayerPeek(playerId, element);
	}, OPEN_DELAY_MS);
}

export function schedulePlayerPeekClose(): void {
	if (pinned) return;
	if (openTimer) {
		clearTimeout(openTimer);
		openTimer = null;
	}
	if (closeTimer) clearTimeout(closeTimer);
	closeTimer = setTimeout(() => {
		closeTimer = null;
		closePlayerPeek();
	}, CLOSE_DELAY_MS);
}

export function cancelPlayerPeekClose(): void {
	if (closeTimer) {
		clearTimeout(closeTimer);
		closeTimer = null;
	}
}

export function closePlayerPeek(options: { restoreFocus?: boolean } = {}): void {
	clearTimers();
	controller?.abort();
	controller = null;
	const focusTarget = triggerElement;
	openId = null;
	anchor = null;
	view = null;
	status = 'idle';
	pinned = false;
	triggerElement = null;
	if (focusTarget) syncTriggerExpanded(focusTarget, null, '');
	if (options.restoreFocus && focusTarget?.isConnected) {
		focusTarget.focus();
	}
}

export const playerPeek = {
	get openId() {
		return openId;
	},
	get anchor() {
		return anchor;
	},
	get view() {
		return view;
	},
	get status() {
		return status;
	},
	get pinned() {
		return pinned;
	}
};

/**
 * Les déclencheurs globaux du peek. La coquille importe ce module après la
 * peinture initiale; la carte elle-même reste un import paresseux.
 */
export function installPlayerPeekTriggers(): () => void {
	function triggerFrom(target: EventTarget | null): HTMLElement | null {
		if (!(target instanceof Element)) return null;
		const trigger = target.closest<HTMLElement>('[data-player-peek]');
		if (!trigger || trigger.closest('[data-player-peek-card]')) return null;
		return trigger.dataset.playerId ? trigger : null;
	}

	function onPointerOver(event: PointerEvent) {
		const trigger = triggerFrom(event.target);
		if (!trigger) return;
		if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) {
			return;
		}
		schedulePlayerPeekOpen(trigger.dataset.playerId as string, trigger);
	}

	function onPointerOut(event: PointerEvent) {
		const trigger = triggerFrom(event.target);
		if (!trigger) return;
		if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) {
			return;
		}
		if (openId === trigger.dataset.playerId) schedulePlayerPeekClose();
	}

	function onClick(event: MouseEvent) {
		const trigger = triggerFrom(event.target);
		if (!trigger) {
			if (
				openId &&
				!(event.target instanceof Element && event.target.closest('[data-player-peek-card]'))
			) {
				closePlayerPeek();
			}
			return;
		}
		const playerId = trigger.dataset.playerId as string;
		if (trigger.dataset.playerPeek === 'click') {
			openPlayerPeek(playerId, trigger, { pinned: true });
			return;
		}
		const interactive = trigger.closest('a,button,[role="button"],label');
		if (interactive && interactive !== trigger) return;
		if (trigger.matches('a,button')) return;
		openPlayerPeek(playerId, trigger, { pinned: true });
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && openId) {
			event.preventDefault();
			closePlayerPeek({ restoreFocus: true });
			return;
		}
		if (event.key !== 'Enter' && event.key !== ' ') return;
		const trigger = triggerFrom(event.target);
		if (!trigger || trigger.getAttribute('role') !== 'button') return;
		if (trigger.dataset.playerId === openId) return;
		event.preventDefault();
		openPlayerPeek(trigger.dataset.playerId as string, trigger, { pinned: true });
	}

	function onPointerDown(event: PointerEvent) {
		if (!openId) return;
		if (event.target instanceof Element && event.target.closest('[data-player-peek-card]')) {
			return;
		}
		if (event.target instanceof Element && event.target.closest('[data-player-peek]')) return;
		closePlayerPeek();
	}

	if (typeof document === 'undefined') return () => {};
	document.addEventListener('pointerover', onPointerOver);
	document.addEventListener('pointerout', onPointerOut);
	document.addEventListener('click', onClick);
	document.addEventListener('keydown', onKeyDown);
	document.addEventListener('pointerdown', onPointerDown);
	return () => {
		document.removeEventListener('pointerover', onPointerOver);
		document.removeEventListener('pointerout', onPointerOut);
		document.removeEventListener('click', onClick);
		document.removeEventListener('keydown', onKeyDown);
		document.removeEventListener('pointerdown', onPointerDown);
	};
}
