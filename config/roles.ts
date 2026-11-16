import type { I18nKey } from './i18n/fr.ts';

export const ROLES = [
  { key: 'player', labelKey: 'admin.role.player' },
  { key: 'admin', labelKey: 'admin.role.admin' }
] as const satisfies readonly { key: string; labelKey: I18nKey }[];

export type Role = (typeof ROLES)[number]['key'];

export const ROLE_KEYS = ROLES.map((role) => role.key) as [Role, ...Role[]];

export const DEFAULT_ROLE: Role = 'player';

export function isRole(value: string): value is Role {
  return ROLE_KEYS.includes(value as Role);
}
