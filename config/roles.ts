import { ALL_CAPABILITIES, type Capability } from './capabilities.ts';
import type { I18nKey } from './i18n/fr.ts';

export const ROLES = [
  {
    key: 'player',
    labelKey: 'admin.role.player',
    descriptionKey: 'admin.role.playerHelp',
    capabilities: ['member', 'manageOwnAvailability', 'claimSubs']
  },
  {
    key: 'manager',
    labelKey: 'admin.role.manager',
    descriptionKey: 'admin.role.managerHelp',
    capabilities: [
      'member',
      'manageOwnAvailability',
      'claimSubs',
      'manageGames',
      'manageSubs',
      'moderateChat',
      'viewAdmin'
    ]
  },
  {
    key: 'admin',
    labelKey: 'admin.role.admin',
    descriptionKey: 'admin.role.adminHelp',
    capabilities: ALL_CAPABILITIES
  }
] as const satisfies readonly {
  key: string;
  labelKey: I18nKey;
  descriptionKey: I18nKey;
  capabilities: readonly Capability[];
}[];

export type Role = (typeof ROLES)[number]['key'];

export const ROLE_KEYS = ROLES.map((role) => role.key) as [Role, ...Role[]];

export const DEFAULT_ROLE: Role = 'player';
export const ADMIN_ROLE: Role = 'admin';

export function isRole(value: string): value is Role {
  return ROLE_KEYS.includes(value as Role);
}

export function roleDefinition(role: Role) {
  return ROLES.find((entry) => entry.key === role);
}

export function roleCapabilities(role: Role): readonly Capability[] {
  return roleDefinition(role)?.capabilities ?? [];
}

export function roleHasCapability(role: Role, capability: Capability): boolean {
  return roleCapabilities(role).includes(capability);
}
