/**
 * Le seul propriétaire des décalages de chrome qu'une surface ajoute au
 * défilement du document. Une surface mesure sa propre bande et publie sa
 * hauteur; `layout.css` compose la base et cet appoint une seule fois.
 */
export type ChromeInsetSide = 'top' | 'bottom';

const PROPERTY: Record<ChromeInsetSide, string> = {
	top: '--surface-top-inset',
	bottom: '--surface-bottom-inset'
};

export function publishChromeInset(side: ChromeInsetSide, height: number): void {
	if (typeof document === 'undefined') return;
	const style = document.documentElement.style;
	if (!Number.isFinite(height) || height <= 0) {
		style.removeProperty(PROPERTY[side]);
		return;
	}
	style.setProperty(PROPERTY[side], `${Math.round(height)}px`);
}
