/**
 * Pure geometry for the player peek. Keeping it out of the component makes the
 * clamping rules testable without a DOM.
 */
export type PeekAnchor = {
	top: number;
	left: number;
	width: number;
	height: number;
	bottom: number;
	right: number;
};

export type PeekPlacement = {
	top: number;
	left: number;
	width: number;
};

export type PeekViewport = {
	width: number;
	height: number;
};

export const PEEK_CARD_WIDTH = 344;
export const PEEK_CARD_ESTIMATE_HEIGHT = 420;
export const PEEK_MARGIN = 8;
export const PEEK_MOBILE_BREAKPOINT = 640;

/** Below this width the card becomes a bottom sheet; placement is then CSS-only. */
export function isPeekSheet(viewportWidth: number): boolean {
	return viewportWidth < PEEK_MOBILE_BREAKPOINT;
}

/**
 * Prefer below the trigger, flip above when there is not enough room, then
 * clamp both axes so the card never leaves the viewport.
 */
export function peekPlacement(
	anchor: PeekAnchor,
	viewport: PeekViewport,
	cardWidth = PEEK_CARD_WIDTH,
	cardHeight = PEEK_CARD_ESTIMATE_HEIGHT,
	margin = PEEK_MARGIN
): PeekPlacement {
	const width = Math.min(cardWidth, viewport.width - margin * 2);
	const below = anchor.bottom + margin;
	const above = anchor.top - cardHeight - margin;
	const fitsBelow = below + cardHeight <= viewport.height - margin;
	const top = fitsBelow || above < margin ? below : above;
	const centred = anchor.left + anchor.width / 2 - width / 2;
	const left = Math.min(
		Math.max(centred, margin),
		Math.max(margin, viewport.width - width - margin)
	);
	return {
		top: Math.min(
			Math.max(top, margin),
			Math.max(margin, viewport.height - cardHeight - margin)
		),
		left,
		width
	};
}
