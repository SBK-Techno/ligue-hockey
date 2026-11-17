import type { TextureKey } from './branding-schema.ts';

/**
 * Le contrat des matières. Chaque matière couvre sa surface d'un seul tenant :
 * le papier sur la page, la glace sur la patinoire. Aucune tuile ne se répète,
 * donc aucune couture ni motif en miroir ne peut apparaître. Chaque budget est
 * nommé par sa clé dans `config/performance.ts`, jamais recopié ici.
 */
type Material = {
	width: number;
	height: number;
	quality: number;
	/** Un gamma éclaircit les tons moyens sans pousser un canal au-delà de 255. */
	gamma: number;
	/** Une compression finale garde les hautes lumières sous 255. */
	gain: number;
	budget: 'paperTextureBytes' | 'rinkTextureBytes';
};

export const MATERIALS = {
	paper: {
		width: 1024,
		height: 1024,
		quality: 76,
		gamma: 1.02,
		gain: 0.95,
		budget: 'paperTextureBytes'
	},
	ice: {
		width: 1536,
		height: 922,
		quality: 78,
		gamma: 1,
		gain: 0.92,
		budget: 'rinkTextureBytes'
	}
} as const satisfies Record<TextureKey, Material>;
