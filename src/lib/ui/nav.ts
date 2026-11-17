import type { I18nKey } from '#config/i18n/fr.ts';

/**
 * Un seul prédicat d'état actif pour le menu principal, les onglets admin et
 * les rails. Une destination racine n'est active que sur sa propre page.
 */
export function isActiveHref(pathname: string, href: string, exact = false): boolean {
	if (exact || href === '/') return pathname === href;
	return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Un seul choix de libellé pour la barre mobile : le libellé court déclaré par
 * la surface, sinon son libellé complet. La barre ne décide jamais à sa place.
 */
export function mobileNavLabelKey(surface: {
	labelKey: I18nKey;
	shortLabelKey?: I18nKey;
}): I18nKey {
	return surface.shortLabelKey ?? surface.labelKey;
}

/** La fiche de saison d'un joueur : la seule page où une note manquante se règle. */
export function playerAssessmentHref(playerId: string): string {
	return `/admin/evaluations/${playerId}`;
}
