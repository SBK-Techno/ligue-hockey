import type { I18nKey } from '#config/i18n/fr.ts';

/** Un match a un seul état, et cet état a un seul libellé et un seul ton. */
export type GameStatusTone = 'neutral' | 'ok' | 'alert';

export type GameStatusDefinition = {
	labelKey: I18nKey;
	tone: GameStatusTone;
};

const STATUSES: Record<string, GameStatusDefinition> = {
	scheduled: { labelKey: 'games.status.scheduled', tone: 'neutral' },
	cancelled: { labelKey: 'games.status.cancelled', tone: 'alert' },
	completed: { labelKey: 'games.status.completed', tone: 'ok' }
};

const FALLBACK = STATUSES.scheduled;

export function gameStatus(status: string): GameStatusDefinition {
	return STATUSES[status] ?? FALLBACK;
}
