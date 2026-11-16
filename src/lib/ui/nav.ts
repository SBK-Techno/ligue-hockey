/**
 * Un seul prédicat d'état actif pour le menu principal, les onglets admin et
 * les rails. Une destination racine n'est active que sur sa propre page.
 */
export function isActiveHref(pathname: string, href: string, exact = false): boolean {
	if (exact || href === '/') return pathname === href;
	return pathname === href || pathname.startsWith(`${href}/`);
}

/** La fiche de saison d'un joueur : la seule page où une note manquante se règle. */
export function playerAssessmentHref(playerId: string): string {
	return `/admin/evaluations/${playerId}`;
}
