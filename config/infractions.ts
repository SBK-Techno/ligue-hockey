import type { I18nKey } from './i18n/fr.ts';

/** Minutes de pénalité admises par la feuille de match. */
export const PENALTY_MINUTES = [2, 4, 5, 10] as const;
export type PenaltyMinutes = (typeof PENALTY_MINUTES)[number];

export type InfractionDefinition = {
	key: string;
	labelKey: I18nKey;
	defaultMinutes: PenaltyMinutes;
};

/**
 * Les douze infractions de base d'une ligue de hockey québécoise. Le libellé
 * français vit dans le dictionnaire; la clé est la valeur écrite en base et
 * l'unique registre des choix offerts.
 */
export const INFRACTIONS = [
	{
		key: 'accrochage',
		labelKey: 'infraction.accrochage',
		defaultMinutes: 2
	},
	{
		key: 'obstruction',
		labelKey: 'infraction.obstruction',
		defaultMinutes: 2
	},
	{
		key: 'mise_en_echec',
		labelKey: 'infraction.miseEnEchec',
		defaultMinutes: 2
	},
	{
		key: 'baton_eleve',
		labelKey: 'infraction.batonEleve',
		defaultMinutes: 4
	},
	{
		key: 'rudesse',
		labelKey: 'infraction.rudesse',
		defaultMinutes: 2
	},
	{
		key: 'retard_de_jeu',
		labelKey: 'infraction.retardDeJeu',
		defaultMinutes: 2
	},
	{
		key: 'coup_de_coude',
		labelKey: 'infraction.coupDeCoude',
		defaultMinutes: 2
	},
	{
		key: 'trebucher',
		labelKey: 'infraction.trebucher',
		defaultMinutes: 2
	},
	{
		key: 'mise_en_echec_par_derriere',
		labelKey: 'infraction.miseEnEchecParDerriere',
		defaultMinutes: 5
	},
	{
		key: 'inconduite',
		labelKey: 'infraction.inconduite',
		defaultMinutes: 10
	},
	{
		key: 'contact_a_la_tete',
		labelKey: 'infraction.contactALaTete',
		defaultMinutes: 2
	},
	{
		key: 'dardage',
		labelKey: 'infraction.dardage',
		defaultMinutes: 2
	}
] as const satisfies readonly InfractionDefinition[];

export type InfractionKey = (typeof INFRACTIONS)[number]['key'];

export const INFRACTION_KEYS = INFRACTIONS.map(
	(infraction) => infraction.key
) as [InfractionKey, ...InfractionKey[]];

export function isInfraction(value: string): value is InfractionKey {
	return INFRACTION_KEYS.includes(value as InfractionKey);
}

export function infractionDefinition(key: InfractionKey) {
	const definition = INFRACTIONS.find((infraction) => infraction.key === key);
	if (!definition) {
		throw new Error(`Unknown infraction: ${key}`);
	}
	return definition;
}
