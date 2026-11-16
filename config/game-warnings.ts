import type { I18nKey } from './i18n/fr.ts';

/**
 * Un avertissement d'alignement a un seul état, un seul libellé et une seule
 * gravité. Le générateur, le snapshot enregistré et les pages lisent ce
 * registre : une clé inconnue ne peut plus être stockée ni ignorée.
 */
export type GameWarning =
	| 'unfilled-slots'
	| 'rule-conflict'
	| 'rule-preference'
	| 'rule-limit';

export type GameWarningTone = 'notice' | 'alert';

export type GameWarningDefinition = {
	key: GameWarning;
	labelKey: I18nKey;
	helpKey?: I18nKey;
	playerHelpKey?: I18nKey;
	tone: GameWarningTone;
	/** Un avertissement qui ne concerne que la gestion. */
	managerOnly?: boolean;
	/** Un détail calculé à afficher sous le libellé, déclaré par le registre. */
	detail?: 'open-slots';
};

export const GAME_WARNINGS = [
	{
		key: 'unfilled-slots',
		labelKey: 'games.warning.unfilledSlots',
		tone: 'notice',
		detail: 'open-slots'
	},
	{
		key: 'rule-conflict',
		labelKey: 'games.rulesConflict',
		helpKey: 'games.rulesConflictHelp',
		playerHelpKey: 'games.rulesConflictPlayer',
		tone: 'alert'
	},
	{
		key: 'rule-preference',
		labelKey: 'games.warning.rulePreference',
		tone: 'notice'
	},
	{
		key: 'rule-limit',
		labelKey: 'games.limitConflict',
		helpKey: 'games.limitConflictHelp',
		tone: 'alert',
		managerOnly: true
	}
] as const satisfies readonly GameWarningDefinition[];

export const GAME_WARNING_KEYS = GAME_WARNINGS.map(
	(warning) => warning.key
) as [GameWarning, ...GameWarning[]];

export function isGameWarning(value: string): value is GameWarning {
	return GAME_WARNING_KEYS.includes(value as GameWarning);
}

export function gameWarningDefinition(warning: GameWarning): GameWarningDefinition {
	const definition = GAME_WARNINGS.find((entry) => entry.key === warning);
	if (!definition) {
		throw new Error(`Unknown game warning: ${warning}`);
	}
	return definition;
}

export function gameWarningLabelKey(warning: GameWarning): I18nKey {
	return gameWarningDefinition(warning).labelKey;
}

/** L'ordre du registre est l'ordre d'affichage et de persistance. */
export function gameWarningsInOrder(warnings: readonly GameWarning[]): GameWarning[] {
	const present = new Set(warnings.filter(isGameWarning));
	return GAME_WARNING_KEYS.filter((warning) => present.has(warning));
}
