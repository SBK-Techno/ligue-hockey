export type BadgeTone = 'neutral' | 'ok' | 'alert' | 'ice';

const BADGE_CLASSES: Record<BadgeTone, string> = {
	neutral: 'badge',
	ok: 'badge-ok',
	alert: 'badge-alert',
	ice: 'badge-ice'
};

/**
 * Un seul endroit traduit une tonalité sémantique en classe de badge.
 * Les configs déclarent la tonalité, jamais la classe CSS.
 */
export function badgeClass(tone: BadgeTone | undefined): string {
	return BADGE_CLASSES[tone ?? 'neutral'];
}
