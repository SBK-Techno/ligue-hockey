import { branding } from '#lib/generated/branding.ts';

/**
 * Les deux matières de l'interface. Chaque image couvre sa surface d'un seul
 * tenant : le papier la page, la glace la patinoire.
 */
export const materials = {
	paper: branding.textures.paper,
	ice: branding.textures.ice
} as const;

export function materialVars(kind: keyof typeof materials): string {
	const prefix = kind === 'paper' ? '--page' : '--rink';
	return [
		`${prefix}-material-image: url(${materials[kind]})`,
		`${prefix}-material-size: cover`,
		`${prefix}-material-repeat: no-repeat`
	].join('; ');
}
