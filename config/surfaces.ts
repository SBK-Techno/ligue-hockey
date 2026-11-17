import type { Capability } from './capabilities.ts';
import type { I18nKey } from './i18n/fr.ts';

export type SurfaceDefinition = {
  key: string;
  href: string;
  labelKey: I18nKey;
  /** Libellé court pour la barre mobile quand le libellé complet ne tient pas. */
  shortLabelKey?: I18nKey;
  icon: string;
  capabilities: readonly Capability[];
  placement: 'primary' | 'account';
  /** Ordre dans la barre mobile. Les cinq plus petits gagnent. */
  mobilePriority: number;
};

/**
 * Une surface est une destination de navigation. Le rôle ne choisit pas la
 * navigation directement : chaque surface déclare les capacités requises.
 */
export const SURFACES = [
  {
    key: 'home',
    href: '/',
    labelKey: 'nav.home',
    icon: 'home',
    capabilities: ['member'],
    placement: 'primary',
    mobilePriority: 10
  },
  {
    key: 'games',
    href: '/matchs',
    labelKey: 'nav.games',
    icon: 'puck',
    capabilities: ['member'],
    placement: 'primary',
    mobilePriority: 20
  },
  {
    key: 'subs',
    href: '/remplacants',
    labelKey: 'subs.title',
    shortLabelKey: 'subs.short',
    icon: 'sub',
    capabilities: ['claimSubs', 'manageSubs'],
    placement: 'primary',
    mobilePriority: 30
  },
  {
    key: 'chat',
    href: '/discussion',
    labelKey: 'nav.chat',
    icon: 'chat',
    capabilities: ['member'],
    placement: 'primary',
    mobilePriority: 40
  },
  {
    key: 'account',
    href: '/profil',
    labelKey: 'nav.profile',
    icon: 'user',
    capabilities: ['member'],
    placement: 'primary',
    mobilePriority: 60
  },
  {
    key: 'management',
    href: '/admin',
    labelKey: 'nav.admin',
    icon: 'shield',
    capabilities: ['viewAdmin'],
    placement: 'primary',
    mobilePriority: 50
  }
] as const satisfies readonly SurfaceDefinition[];

/** Toutes les surfaces portent le libellé court optionnel, même celles qui n'en ont pas. */
export type Surface = (typeof SURFACES)[number] & SurfaceDefinition;
export type SurfaceKey = Surface['key'];
