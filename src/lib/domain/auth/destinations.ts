import { ADMIN_TABS, type AdminTab } from '#config/admin-tabs.ts';
import { can } from './policy.ts';
import type { Actor } from './types.ts';

/**
 * Les écrans d'administration que cet acteur peut ouvrir, sans le tableau de
 * bord : c'est la liste des raccourcis de gestion sur l'accueil et le profil.
 */
export function managementTabs(actor: Actor): readonly AdminTab[] {
	return ADMIN_TABS.filter((tab) => tab.href !== '/admin' && can(actor, tab.capability));
}
