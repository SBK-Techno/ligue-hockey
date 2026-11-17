/**
 * Un défilement animé ignore le choix du lecteur. Sous mouvement réduit,
 * on saute directement à la cible.
 */
export function scrollBehavior(reducedMotion: boolean): ScrollBehavior {
	return reducedMotion ? 'auto' : 'smooth';
}

export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
