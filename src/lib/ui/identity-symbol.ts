/**
 * L'identifiant stable d'un symbole dans la planche SVG des identités. Le
 * générateur et le composant Avatar partagent cette seule convention.
 */
export function identitySymbolId(identityId: string): string {
	return `identity-${identityId}`;
}
