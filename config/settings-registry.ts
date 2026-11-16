import { z } from 'zod';
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
    schema: z.string().max(120),
    defaultValue: '',
    max: 120,
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
  'games.availabilityClosesHours': defineSetting({
    group: 'games',
    kind: 'number',
    schema: z.number().int().min(0).max(72),
    defaultValue: 12,
    min: 0,
    max: 72,
    step: 1,
    labelKey: 'settings.availabilityClosesHours.label',
    descriptionKey: 'settings.availabilityClosesHours.description'
  }),
  'roster.goaliesPerTeam': defineSetting({
    group: 'roster',
    kind: 'number',
    schema: z.number().int().min(0).max(3),
    defaultValue: 1,
    min: 0,
    max: 3,
    step: 1,
    labelKey: 'settings.goaliesPerTeam.label',
    descriptionKey: 'settings.goaliesPerTeam.description'
  }),
  'roster.forwardsPerTeam': defineSetting({
    group: 'roster',
    kind: 'number',
    schema: z.number().int().min(0).max(8),
    defaultValue: 3,
    min: 0,
    max: 8,
    step: 1,
    labelKey: 'settings.forwardsPerTeam.label',
    descriptionKey: 'settings.forwardsPerTeam.description'
  }),
  'roster.defensePerTeam': defineSetting({
    group: 'roster',
    kind: 'number',
    schema: z.number().int().min(0).max(8),
    defaultValue: 2,
    min: 0,
    max: 8,
    step: 1,
    labelKey: 'settings.defensePerTeam.label',
    descriptionKey: 'settings.defensePerTeam.description'
  }),
  'notifications.generalLeadHours': defineSetting({
    group: 'notifications',
    kind: 'number',
    schema: z.number().int().min(0).max(168),
    defaultValue: 12,
    min: 0,
    max: 168,
    step: 1,
    labelKey: 'settings.generalLeadHours.label',
    descriptionKey: 'settings.generalLeadHours.description'
  }),
  'notifications.priorityGapHours': defineSetting({
    group: 'notifications',
    kind: 'number',
    schema: z.number().int().min(0).max(24),
    defaultValue: 4,
    min: 0,
    max: 24,
    step: 1,
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
  'notifications.lastCallMinutes': defineSetting({
    group: 'notifications',
    kind: 'number',
    schema: z.number().int().min(0).max(1440),
    defaultValue: 240,
    min: 0,
    max: 1440,
    step: 15,
    labelKey: 'settings.lastCallMinutes.label',
    descriptionKey: 'settings.lastCallMinutes.description'
  }),
  'finance.totalCents': defineSetting({
    group: 'finance',
    kind: 'money',
    schema: z.number().int().min(0).max(10_000_000),
    defaultValue: 0,
    min: 0,
    max: 10_000_000,
    step: 100,
    labelKey: 'settings.totalCents.label',
    descriptionKey: 'settings.totalCents.description'
  }),
  'finance.firstInstallmentPercent': defineSetting({
    group: 'finance',
    kind: 'number',
    schema: z.number().int().min(1).max(99),
    defaultValue: 50,
    min: 1,
    max: 99,
    step: 1,
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
  'finance.currency': defineSetting({
    group: 'finance',
    kind: 'select',
    schema: z.enum(['CAD', 'USD', 'EUR']),
    defaultValue: 'CAD',
    options: [
      { value: 'CAD', labelKey: 'settings.currency.CAD' },
      { value: 'USD', labelKey: 'settings.currency.USD' },
      { value: 'EUR', labelKey: 'settings.currency.EUR' }
    ],
    labelKey: 'settings.currency.label'
  }),
  'finance.goalieDiscountPercent': defineSetting({
    group: 'finance',
    kind: 'number',
    schema: z.number().int().min(0).max(100),
    defaultValue: 0,
    min: 0,
    max: 100,
    step: 5,
    labelKey: 'settings.goalieDiscountPercent.label',
    descriptionKey: 'settings.goalieDiscountPercent.description'
  }),
  'finance.overdueGraceDays': defineSetting({
    group: 'finance',
    kind: 'number',
    schema: z.number().int().min(0).max(30),
    defaultValue: 0,
    min: 0,
    max: 30,
    step: 1,
    labelKey: 'settings.overdueGraceDays.label',
    descriptionKey: 'settings.overdueGraceDays.description'
  }),
  'teams.skillTolerance': defineSetting({
    group: 'teams',
    kind: 'number',
    schema: z.number().min(0).max(5),
    defaultValue: 0.25,
    min: 0,
    max: 5,
    step: 0.25,
    labelKey: 'settings.skillTolerance.label',
    descriptionKey: 'settings.skillTolerance.description'
  }),
  'teams.maxPlayers': defineSetting({
    group: 'teams',
    kind: 'number',
    schema: z.number().int().min(2).max(40),
    defaultValue: 24,
    min: 2,
    max: 40,
    step: 1,
    labelKey: 'settings.maxPlayers.label',
    descriptionKey: 'settings.maxPlayers.description'
  }),
  'teams.maxSkillSpread': defineSetting({
    group: 'teams',
    kind: 'number',
    schema: z.number().min(0).max(10),
    defaultValue: 0,
    min: 0,
    max: 10,
    step: 0.25,
    labelKey: 'settings.maxSkillSpread.label',
    descriptionKey: 'settings.maxSkillSpread.description'
  }),
  'teams.maxAgeSpread': defineSetting({
    group: 'teams',
    kind: 'number',
    schema: z.number().min(0).max(60),
    defaultValue: 0,
    min: 0,
    max: 60,
    step: 0.5,
    labelKey: 'settings.maxAgeSpread.label',
    descriptionKey: 'settings.maxAgeSpread.description'
  }),
  'teams.maxSizeSpread': defineSetting({
    group: 'teams',
    kind: 'number',
    schema: z.number().int().min(0).max(10),
    defaultValue: 0,
    min: 0,
    max: 10,
    step: 1,
    labelKey: 'settings.maxSizeSpread.label',
    descriptionKey: 'settings.maxSizeSpread.description'
  }),
  'chat.maxMessageLength': defineSetting({
    group: 'chat',
    kind: 'number',
    schema: z.number().int().min(10).max(10_000),
    defaultValue: 2000,
    min: 10,
    max: 10_000,
    step: 10,
    labelKey: 'settings.maxMessageLength.label',
    descriptionKey: 'settings.maxMessageLength.description'
  }),
  'chat.maxPollOptions': defineSetting({
    group: 'chat',
    kind: 'number',
    schema: z.number().int().min(2).max(12),
    defaultValue: 6,
    min: 2,
    max: 12,
    step: 1,
    labelKey: 'settings.maxPollOptions.label',
    descriptionKey: 'settings.maxPollOptions.description'
  }),
  'chat.pollMinOptions': defineSetting({
    group: 'chat',
    kind: 'number',
    schema: z.number().int().min(2).max(6),
    defaultValue: 2,
    min: 2,
    max: 6,
    step: 1,
    labelKey: 'settings.pollMinOptions.label',
    descriptionKey: 'settings.pollMinOptions.description'
  }),
  'chat.pageSize': defineSetting({
    group: 'chat',
    kind: 'number',
    schema: z.number().int().min(10).max(200),
    defaultValue: 50,
    min: 10,
    max: 200,
    step: 10,
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
    check: (values) =>
      values['notifications.generalLeadHours'] +
        values['notifications.priorityGapHours'] <=
      168,
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
