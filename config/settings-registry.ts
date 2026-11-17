import { z } from 'zod';
import { FINANCE_LIMITS } from './finance.ts';
import { LOCATION_LIMITS } from './games.ts';
import { CHAT_PAGE_SIZE } from './chat.ts';
import type { I18nKey } from './i18n/fr';
import { TEAMS } from './teams.ts';
import { DATE_PATTERN, TIME_PATTERN } from './time.ts';

export const SETTING_GROUPS = [
  { key: 'league', labelKey: 'settings.group.league' },
  { key: 'games', labelKey: 'settings.group.games' },
  { key: 'roster', labelKey: 'settings.group.roster' },
  { key: 'notifications', labelKey: 'settings.group.notifications' },
  { key: 'finance', labelKey: 'settings.group.finance' },
  { key: 'teams', labelKey: 'settings.group.teams' },
  { key: 'chat', labelKey: 'settings.group.chat' }
] as const satisfies readonly { key: string; labelKey: I18nKey }[];

export type SettingGroup = (typeof SETTING_GROUPS)[number]['key'];

export type SettingKind =
  | 'text'
  | 'number'
  | 'money'
  | 'boolean'
  | 'date'
  | 'time'
  | 'select';

export type SettingOption = {
  value: string;
  labelKey: I18nKey;
};

export type SettingDefinition<T> = {
  group: SettingGroup;
  kind: SettingKind;
  schema: z.ZodType<T>;
  defaultValue: T;
  labelKey: I18nKey;
  descriptionKey?: I18nKey;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly SettingOption[];
};

function defineSetting<T>(definition: SettingDefinition<T>) {
  return definition;
}

/**
 * Un réglage numérique déclare sa borne une seule fois. Le schéma Zod et les
 * attributs du champ d'administration en sont dérivés, donc ils ne peuvent
 * pas diverger.
 */
function defineNumericSetting(definition: {
  group: SettingGroup;
  kind: 'number' | 'money';
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  defaultValue: number;
  labelKey: I18nKey;
  descriptionKey?: I18nKey;
}): SettingDefinition<number> {
  const { integer = false, ...rest } = definition;
  if (definition.min > definition.max) {
    throw new Error(`Le réglage ${definition.labelKey} a une borne inversée.`);
  }
  if (definition.step <= 0) {
    throw new Error(`Le réglage ${definition.labelKey} doit avoir un pas positif.`);
  }
  if (
    definition.defaultValue < definition.min ||
    definition.defaultValue > definition.max
  ) {
    throw new Error(`Le réglage ${definition.labelKey} a un défaut hors bornes.`);
  }
  const bounded = z.number().min(definition.min).max(definition.max);
  return {
    ...rest,
    schema: integer ? bounded.int() : bounded
  };
}

const dateString = z
  .string()
  .regex(DATE_PATTERN, 'invalid-date')
  .nullable();

const timeString = z.string().regex(TIME_PATTERN, 'invalid-time');

export const SETTINGS = {
  'league.seasonLabel': defineSetting({
    group: 'league',
    kind: 'text',
    schema: z.string().min(1).max(40),
    defaultValue: 'Saison',
    labelKey: 'settings.seasonLabel.label',
    descriptionKey: 'settings.seasonLabel.description'
  }),
  'games.defaultLocation': defineSetting({
    group: 'games',
    kind: 'text',
    schema: z.string().max(LOCATION_LIMITS.nameMax),
    defaultValue: '',
    max: LOCATION_LIMITS.nameMax,
    labelKey: 'settings.defaultLocation.label',
    descriptionKey: 'settings.defaultLocation.description'
  }),
  'games.defaultStartTime': defineSetting({
    group: 'games',
    kind: 'time',
    schema: timeString,
    defaultValue: '09:00',
    labelKey: 'settings.defaultStartTime.label',
    descriptionKey: 'settings.defaultStartTime.description'
  }),
  'games.availabilityClosesHours': defineNumericSetting({
    group: 'games',
    kind: 'number',
    min: 0,
    max: 72,
    step: 1,
    integer: true,
    defaultValue: 12,
    labelKey: 'settings.availabilityClosesHours.label',
    descriptionKey: 'settings.availabilityClosesHours.description'
  }),
  'roster.goaliesPerTeam': defineNumericSetting({
    group: 'roster',
    kind: 'number',
    min: 0,
    max: 3,
    step: 1,
    integer: true,
    defaultValue: 1,
    labelKey: 'settings.goaliesPerTeam.label',
    descriptionKey: 'settings.goaliesPerTeam.description'
  }),
  'roster.forwardsPerTeam': defineNumericSetting({
    group: 'roster',
    kind: 'number',
    min: 0,
    max: 8,
    step: 1,
    integer: true,
    defaultValue: 3,
    labelKey: 'settings.forwardsPerTeam.label',
    descriptionKey: 'settings.forwardsPerTeam.description'
  }),
  'roster.defensePerTeam': defineNumericSetting({
    group: 'roster',
    kind: 'number',
    min: 0,
    max: 8,
    step: 1,
    integer: true,
    defaultValue: 2,
    labelKey: 'settings.defensePerTeam.label',
    descriptionKey: 'settings.defensePerTeam.description'
  }),
  'notifications.generalLeadHours': defineNumericSetting({
    group: 'notifications',
    kind: 'number',
    min: 0,
    max: 168,
    step: 1,
    integer: true,
    defaultValue: 12,
    labelKey: 'settings.generalLeadHours.label',
    descriptionKey: 'settings.generalLeadHours.description'
  }),
  'notifications.priorityGapHours': defineNumericSetting({
    group: 'notifications',
    kind: 'number',
    min: 0,
    max: 24,
    step: 1,
    integer: true,
    defaultValue: 4,
    labelKey: 'settings.priorityGapHours.label',
    descriptionKey: 'settings.priorityGapHours.description'
  }),
  'notifications.emailEnabled': defineSetting({
    group: 'notifications',
    kind: 'boolean',
    schema: z.boolean(),
    defaultValue: true,
    labelKey: 'settings.emailEnabled.label',
    descriptionKey: 'settings.emailEnabled.description'
  }),
  'notifications.pushEnabled': defineSetting({
    group: 'notifications',
    kind: 'boolean',
    schema: z.boolean(),
    defaultValue: true,
    labelKey: 'settings.pushEnabled.label',
    descriptionKey: 'settings.pushEnabled.description'
  }),
  'notifications.subRequestOnAbsence': defineSetting({
    group: 'notifications',
    kind: 'boolean',
    schema: z.boolean(),
    defaultValue: true,
    labelKey: 'settings.subRequestOnAbsence.label',
    descriptionKey: 'settings.subRequestOnAbsence.description'
  }),
  'notifications.lastCallMinutes': defineNumericSetting({
    group: 'notifications',
    kind: 'number',
    min: 0,
    max: 1440,
    step: 15,
    integer: true,
    defaultValue: 240,
    labelKey: 'settings.lastCallMinutes.label',
    descriptionKey: 'settings.lastCallMinutes.description'
  }),
  'finance.totalCents': defineNumericSetting({
    group: 'finance',
    kind: 'money',
    min: 0,
    max: 10_000_000,
    step: 100,
    integer: true,
    defaultValue: 0,
    labelKey: 'settings.totalCents.label',
    descriptionKey: 'settings.totalCents.description'
  }),
  'finance.firstInstallmentPercent': defineNumericSetting({
    group: 'finance',
    kind: 'number',
    min: FINANCE_LIMITS.firstInstallmentPercent.min,
    max: FINANCE_LIMITS.firstInstallmentPercent.max,
    step: 1,
    integer: true,
    defaultValue: 50,
    labelKey: 'settings.firstInstallmentPercent.label',
    descriptionKey: 'settings.firstInstallmentPercent.description'
  }),
  'finance.installment1Due': defineSetting({
    group: 'finance',
    kind: 'date',
    schema: dateString,
    defaultValue: null,
    labelKey: 'settings.installment1Due.label'
  }),
  'finance.installment2Due': defineSetting({
    group: 'finance',
    kind: 'date',
    schema: dateString,
    defaultValue: null,
    labelKey: 'settings.installment2Due.label'
  }),
  'finance.goalieDiscountPercent': defineNumericSetting({
    group: 'finance',
    kind: 'number',
    min: 0,
    max: 100,
    step: 5,
    integer: true,
    defaultValue: 0,
    labelKey: 'settings.goalieDiscountPercent.label',
    descriptionKey: 'settings.goalieDiscountPercent.description'
  }),
  'finance.overdueGraceDays': defineNumericSetting({
    group: 'finance',
    kind: 'number',
    min: 0,
    max: 30,
    step: 1,
    integer: true,
    defaultValue: 0,
    labelKey: 'settings.overdueGraceDays.label',
    descriptionKey: 'settings.overdueGraceDays.description'
  }),
  'teams.skillTolerance': defineNumericSetting({
    group: 'teams',
    kind: 'number',
    min: 0,
    max: 5,
    step: 0.25,
    defaultValue: 0.25,
    labelKey: 'settings.skillTolerance.label',
    descriptionKey: 'settings.skillTolerance.description'
  }),
  'teams.maxPlayers': defineNumericSetting({
    group: 'teams',
    kind: 'number',
    min: 2,
    max: 40,
    step: 1,
    integer: true,
    defaultValue: 24,
    labelKey: 'settings.maxPlayers.label',
    descriptionKey: 'settings.maxPlayers.description'
  }),
  'teams.maxSkillSpread': defineNumericSetting({
    group: 'teams',
    kind: 'number',
    min: 0,
    max: 10,
    step: 0.25,
    defaultValue: 0,
    labelKey: 'settings.maxSkillSpread.label',
    descriptionKey: 'settings.maxSkillSpread.description'
  }),
  'teams.maxAgeSpread': defineNumericSetting({
    group: 'teams',
    kind: 'number',
    min: 0,
    max: 60,
    step: 0.5,
    defaultValue: 0,
    labelKey: 'settings.maxAgeSpread.label',
    descriptionKey: 'settings.maxAgeSpread.description'
  }),
  'teams.maxSizeSpread': defineNumericSetting({
    group: 'teams',
    kind: 'number',
    min: 0,
    max: 10,
    step: 1,
    integer: true,
    defaultValue: 0,
    labelKey: 'settings.maxSizeSpread.label',
    descriptionKey: 'settings.maxSizeSpread.description'
  }),
  'chat.maxMessageLength': defineNumericSetting({
    group: 'chat',
    kind: 'number',
    min: 10,
    max: 10_000,
    step: 10,
    integer: true,
    defaultValue: 2000,
    labelKey: 'settings.maxMessageLength.label',
    descriptionKey: 'settings.maxMessageLength.description'
  }),
  'chat.maxPollOptions': defineNumericSetting({
    group: 'chat',
    kind: 'number',
    min: 2,
    max: 12,
    step: 1,
    integer: true,
    defaultValue: 6,
    labelKey: 'settings.maxPollOptions.label',
    descriptionKey: 'settings.maxPollOptions.description'
  }),
  'chat.pollMinOptions': defineNumericSetting({
    group: 'chat',
    kind: 'number',
    min: 2,
    max: 6,
    step: 1,
    integer: true,
    defaultValue: 2,
    labelKey: 'settings.pollMinOptions.label',
    descriptionKey: 'settings.pollMinOptions.description'
  }),
  'chat.pageSize': defineNumericSetting({
    group: 'chat',
    kind: 'number',
    // Le service plafonne à CHAT_PAGE_SIZE; le réglage ne peut donc que réduire.
    min: 10,
    max: CHAT_PAGE_SIZE,
    step: 10,
    integer: true,
    defaultValue: CHAT_PAGE_SIZE,
    labelKey: 'settings.chatPageSize.label',
    descriptionKey: 'settings.chatPageSize.description'
  }),
  'chat.allowPlayerPolls': defineSetting({
    group: 'chat',
    kind: 'boolean',
    schema: z.boolean(),
    defaultValue: true,
    labelKey: 'settings.allowPlayerPolls.label',
    descriptionKey: 'settings.allowPlayerPolls.description'
  })
} as const;

export type SettingsKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingsKey> = z.infer<
  (typeof SETTINGS)[K]['schema']
>;
export type SettingsValues = { [K in SettingsKey]: SettingValue<K> };

export const SETTINGS_KEYS = Object.keys(SETTINGS) as SettingsKey[];

export type SettingInvariant = {
  keys: readonly SettingsKey[];
  check: (values: SettingsValues) => boolean;
  messageKey: I18nKey;
};

export const SETTINGS_INVARIANTS: readonly SettingInvariant[] = [
  {
    keys: ['chat.pollMinOptions', 'chat.maxPollOptions'],
    check: (values) =>
      values['chat.pollMinOptions'] <= values['chat.maxPollOptions'],
    messageKey: 'settings.invariant.pollOptions'
  },
  {
    keys: ['finance.installment1Due', 'finance.installment2Due'],
    check: (values) => {
      const first = values['finance.installment1Due'];
      const second = values['finance.installment2Due'];
      return !first || !second || first < second;
    },
    messageKey: 'settings.invariant.installmentDates'
  },
  {
    keys: [
      'notifications.generalLeadHours',
      'notifications.priorityGapHours'
    ],
    // La fenêtre totale ne peut pas dépasser l'avance maximale déclarée par
    // le réglage lui-même : le nombre 168 n'existe qu'à un seul endroit.
    check: (values) =>
      values['notifications.generalLeadHours'] +
        values['notifications.priorityGapHours'] <=
      settingBound('notifications.generalLeadHours', 'max'),
    messageKey: 'settings.invariant.notificationWindow'
  },
  {
    keys: ['roster.forwardsPerTeam', 'roster.defensePerTeam'],
    check: (values) =>
      values['roster.forwardsPerTeam'] + values['roster.defensePerTeam'] > 0,
    messageKey: 'settings.invariant.roster'
  },
  {
    keys: [
      'teams.maxPlayers',
      'roster.forwardsPerTeam',
      'roster.defensePerTeam',
      'roster.goaliesPerTeam'
    ],
    check: (values) => {
      const perMatch =
        (values['roster.forwardsPerTeam'] +
          values['roster.defensePerTeam'] +
          values['roster.goaliesPerTeam']) *
        TEAMS.length;
      return values['teams.maxPlayers'] >= perMatch;
    },
    messageKey: 'settings.invariant.maxPlayers'
  }
];

export class SettingsError extends Error {
  readonly issues: { key: SettingsKey; message: string }[];
  readonly invariantKey?: I18nKey;

  constructor(
    issues: { key: SettingsKey; message: string }[],
    invariantKey?: I18nKey
  ) {
    super('Invalid league settings');
    this.name = 'SettingsError';
    this.issues = issues;
    this.invariantKey = invariantKey;
  }
}

export function defaultSettings(): SettingsValues {
  return Object.fromEntries(
    SETTINGS_KEYS.map((key) => [key, SETTINGS[key].defaultValue])
  ) as SettingsValues;
}

/**
 * Les validateurs de formulaire réutilisent la borne déclarée par le réglage
 * au lieu de recopier le même nombre.
 */
export function settingBound(key: SettingsKey, bound: 'min' | 'max'): number {
  const value = SETTINGS[key][bound];
  if (typeof value !== 'number') {
    throw new Error(`Le réglage ${key} doit déclarer une borne ${bound}.`);
  }
  return value;
}

export function parseSettings(
  input: Readonly<Record<string, unknown>>
): SettingsValues {
  const issues: { key: SettingsKey; message: string }[] = [];
  const values = {} as Record<SettingsKey, unknown>;

  for (const key of SETTINGS_KEYS) {
    const definition = SETTINGS[key];
    const raw = input[key] ?? definition.defaultValue;
    const result = definition.schema.safeParse(raw);
    if (result.success) {
      values[key] = result.data;
    } else {
      issues.push({
        key,
        message: result.error.issues[0]?.message ?? 'invalid'
      });
    }
  }

  if (issues.length > 0) {
    throw new SettingsError(issues);
  }

  const parsed = values as SettingsValues;
  const invariant = SETTINGS_INVARIANTS.find((entry) => !entry.check(parsed));
  if (invariant) {
    throw new SettingsError([], invariant.messageKey);
  }

  return parsed;
}

export function isSettingsKey(value: string): value is SettingsKey {
  return value in SETTINGS;
}
