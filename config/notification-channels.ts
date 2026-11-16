import type { I18nKey } from '#config/i18n/fr.ts';

export const NOTIFICATION_CHANNELS = [
  { key: 'in_app', labelKey: 'notifications.channel.inApp' },
  { key: 'email', labelKey: 'notifications.channel.email' },
  { key: 'push', labelKey: 'notifications.channel.push' }
] as const satisfies readonly { key: string; labelKey: I18nKey }[];

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]['key'];

export const NOTIFICATION_CHANNEL_KEYS = NOTIFICATION_CHANNELS.map(
  (channel) => channel.key
) as [NotificationChannel, ...NotificationChannel[]];

export const EXTERNAL_NOTIFICATION_CHANNELS = ['email', 'push'] as const;
