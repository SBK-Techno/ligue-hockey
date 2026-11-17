/**
 * Le contrat des matières : une tuile tuilée à l'échelle 1:1, assez petite
 * pour rester sous le budget et sans gain linéaire qui écrête les canaux.
 */
export const MATERIALS = {
	tileSize: 512,
	webpQuality: 65,
	/** Un gamma éclaircit les tons moyens sans pousser un canal au-delà de 255. */
	gamma: {
		paper: 1.06,
		ice: 1.08
	}
} as const;
