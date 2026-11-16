import type { I18nKey } from './i18n/fr.ts';
import type { BalanceStatus } from '#lib/domain/finance/policy.ts';

type BalanceStatusDefinition = {
	labelKey: I18nKey;
	tone: 'neutral' | 'ok' | 'alert' | 'ice';
};

/** Un seul propriétaire du libellé et de la tonalité d'un statut de solde. */
export const BALANCE_STATUS: Record<BalanceStatus, BalanceStatusDefinition> = {
	paid: { labelKey: 'balance.status.paid', tone: 'ok' },
	partial: { labelKey: 'balance.status.partial', tone: 'ice' },
	overdue: { labelKey: 'balance.status.overdue', tone: 'alert' },
	upcoming: { labelKey: 'balance.status.upcoming', tone: 'neutral' }
};

export function balanceStatusDefinition(status: BalanceStatus): BalanceStatusDefinition {
	return BALANCE_STATUS[status];
}
