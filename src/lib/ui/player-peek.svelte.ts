import type { PlayerPeekView } from '#lib/domain/players/peek.ts';
import { clock } from '#lib/shared/time/clock.ts';
import type { PeekAnchor } from './player-peek.ts';

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
const cache: Record<string, { at: number; view: PlayerPeekView }> = {};

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

async function load(playerId: string): Promise<void> {
	controller?.abort();
	const current = new AbortController();
	controller = current;
	try {
		const response = await fetch(
			`/api/joueurs/${encodeURIComponent(playerId)}`,
			{ signal: current.signal, headers: { accept: 'application/json' } }
		);
		if (!response.ok) throw new Error(`peek ${response.status}`);
		const data = (await response.json()) as PlayerPeekView;
		cache[playerId] = { at: clock.nowMs(), view: data };
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
	triggerElement = element;
	anchor = anchorOf(element);
	if (openId === playerId) {
		if (options.pinned) pinned = true;
		return;
	}
	controller?.abort();
	openId = playerId;
	pinned = options.pinned ?? false;
	const cached = cache[playerId];
	if (cached && clock.nowMs() - cached.at < CACHE_TTL_MS) {
		view = cached.view;
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
