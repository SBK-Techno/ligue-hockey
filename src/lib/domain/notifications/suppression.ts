/**
 * Les raisons pour lesquelles `notify()` n'a créé aucun travail. Elles sont
 * comptées en mémoire depuis le démarrage du processus : un journal ou la
 * santé ne doivent jamais exposer un destinataire ni un contenu.
 */
export const SUPPRESSION_REASONS = [
	'channel_disabled',
	'preference_disabled',
	'no_push_subscription'
] as const;

export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];
export type SuppressionCounts = Record<SuppressionReason, number>;

const counts: SuppressionCounts = {
	channel_disabled: 0,
	preference_disabled: 0,
	no_push_subscription: 0
};

export function recordSuppression(reason: SuppressionReason): void {
	counts[reason] += 1;
}

export function suppressionCounts(): SuppressionCounts {
	return { ...counts };
}
