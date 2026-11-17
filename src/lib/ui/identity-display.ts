/**
 * L'identifiant stable d'un symbole dans la planche SVG des identités. Le
 * générateur et le composant Avatar partagent cette seule convention.
 */
export function identitySymbolId(identityId: string): string {
	return `identity-${identityId}`;
}

/**
 * Les initiales de repli quand aucune identité du catalogue n'est disponible.
 * Un seul format pour l'avatar, l'en-tête de profil et les listes.
 */
export function monogram(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('');
}
