import type { Capability } from './capabilities.ts';
import type { I18nKey } from './i18n/fr.ts';

/**
 * Les écrans d'administration et la capacité qui ouvre chacun.
 * La barre latérale, les onglets mobiles et les raccourcis du tableau de bord
 * lisent tous cette liste.
 */
export type AdminTab = {
	href: string;
	labelKey: I18nKey;
	capability: Capability;
};

export const ADMIN_TABS: readonly AdminTab[] = [
	{ href: '/admin', labelKey: 'admin.dashboard', capability: 'viewAdmin' },
	{ href: '/admin/joueurs', labelKey: 'admin.players', capability: 'managePlayers' },
	{ href: '/admin/matchs', labelKey: 'admin.games', capability: 'manageGames' },
	{ href: '/admin/regles', labelKey: 'admin.rules', capability: 'manageRules' },
	{ href: '/admin/soldes', labelKey: 'admin.balances', capability: 'viewAllBalances' },
	{ href: '/admin/parametres', labelKey: 'admin.settings', capability: 'manageSettings' }
];
