/**
 * Les bornes du pourcentage de mise de fonds, partagées par le formulaire
 * d'administration et par le registre des réglages. Ce module reste sans zod
 * pour que la page admin ne charge jamais le validateur côté navigateur.
 */
export const FINANCE_LIMITS = {
	firstInstallmentPercent: {
		min: 1,
		max: 99
	}
} as const;
