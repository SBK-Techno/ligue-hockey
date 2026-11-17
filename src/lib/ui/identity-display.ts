import { IDENTITY_SHEET } from '#config/identity-sheet.ts';
import { branding } from '#lib/generated/branding.ts';

/**
 * La position d'une identité dans la planche unique. L'ordre vient de l'index
 * généré du catalogue; aucun composant ne recompose un nom de fichier ni un
 * indice de tuile.
 */
const identityIds = branding.identities.ids;
const columns = IDENTITY_SHEET.columns;
const rows = Math.ceil(identityIds.length / columns);
const positions = new Map<string, { x: number; y: number }>(
	identityIds.map((identityId, index) => [
		identityId,
		{
			x: ((index % columns) / (columns - 1)) * 100,
			y: (Math.floor(index / columns) / (rows - 1)) * 100
		}
	])
);

/**
 * Le style de la tuile d'une identité dans la planche. Une image, une taille
 * de fond commune, une position par identité : le navigateur ne télécharge
 * jamais un fichier par identité.
 */
export function identitySheetStyle(identityId: string): string {
	const position = positions.get(identityId);
	if (!position) return '';
	return [
		`background-image: url(${branding.identitySheet})`,
		`background-size: ${columns * 100}% ${rows * 100}%`,
		`background-position: ${position.x}% ${position.y}%`,
		'background-repeat: no-repeat'
	].join('; ');
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
