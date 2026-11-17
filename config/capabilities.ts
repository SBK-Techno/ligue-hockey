import type { I18nKey } from './i18n/fr.ts';

/**
 * Une seule liste de capacités pour toute l'application.
 *
 * Un rôle est un ensemble de capacités. Les services demandent une capacité,
 * jamais un rôle, pour que de nouveaux rôles n'exigent aucune modification
 * dans les règles métier.
 */
export const CAPABILITIES = [
  {
    key: 'member',
    labelKey: 'capability.member',
    descriptionKey: 'capability.memberHelp'
  },
  {
    key: 'claimSubs',
    labelKey: 'capability.claimSubs',
    descriptionKey: 'capability.claimSubsHelp'
  },
  {
    key: 'manageOwnAvailability',
    labelKey: 'capability.manageOwnAvailability',
    descriptionKey: 'capability.manageOwnAvailabilityHelp'
  },
  {
    key: 'managePlayers',
    labelKey: 'capability.managePlayers',
    descriptionKey: 'capability.managePlayersHelp'
  },
  {
    key: 'deletePlayer',
    labelKey: 'capability.deletePlayer',
    descriptionKey: 'capability.deletePlayerHelp'
  },
  {
    key: 'editRatings',
    labelKey: 'capability.editRatings',
    descriptionKey: 'capability.editRatingsHelp'
  },
  {
    key: 'manageGames',
    labelKey: 'capability.manageGames',
    descriptionKey: 'capability.manageGamesHelp'
  },
  {
    key: 'manageRules',
    labelKey: 'capability.manageRules',
    descriptionKey: 'capability.manageRulesHelp'
  },
  {
    key: 'manageSettings',
    labelKey: 'capability.manageSettings',
    descriptionKey: 'capability.manageSettingsHelp'
  },
  {
    key: 'manageSubs',
    labelKey: 'capability.manageSubs',
    descriptionKey: 'capability.manageSubsHelp'
  },
  {
    key: 'moderateChat',
    labelKey: 'capability.moderateChat',
    descriptionKey: 'capability.moderateChatHelp'
  },
  {
    key: 'recordPayments',
    labelKey: 'capability.recordPayments',
    descriptionKey: 'capability.recordPaymentsHelp'
  },
  {
    key: 'viewAllBalances',
    labelKey: 'capability.viewAllBalances',
    descriptionKey: 'capability.viewAllBalancesHelp'
  },
  {
    key: 'viewAdmin',
    labelKey: 'capability.viewAdmin',
    descriptionKey: 'capability.viewAdminHelp'
  }
] as const satisfies readonly { key: string; labelKey: I18nKey; descriptionKey: I18nKey }[];

export type Capability = (typeof CAPABILITIES)[number]['key'];

export const CAPABILITY_KEYS = CAPABILITIES.map((capability) => capability.key) as [
  Capability,
  ...Capability[]
];

export const ALL_CAPABILITIES: readonly Capability[] = CAPABILITY_KEYS;

export function capabilityDefinition(capability: Capability) {
  return CAPABILITIES.find((entry) => entry.key === capability);
}
