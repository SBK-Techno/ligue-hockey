import { branding } from '#lib/generated/branding.ts';
import { MATERIALS } from '#config/materials.ts';

/**
 * Les deux matières de l'interface. La tuile est servie à sa taille native,
 * répétée à l'échelle 1:1 : aucune mise à l'échelle ne peut créer de couture.
 */
export const materials = {
	paper: branding.textures.paper,
	ice: branding.textures.ice
} as const;

export function materialVars(kind: keyof typeof materials): string {
	const prefix = kind === 'paper' ? '--page' : '--rink';
	return [
		`${prefix}-material-image: url(${materials[kind]})`,
		`${prefix}-material-size: ${MATERIALS.tileSize}px ${MATERIALS.tileSize}px`,
		`${prefix}-material-repeat: repeat`
	].join('; ');
}
