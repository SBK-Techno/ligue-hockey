import type { I18nKey } from './i18n/fr.ts';

export type PairRuleKind = 'must' | 'must_not';

/**
 * Un mode de règle est la seule chose qu'un admin choisit. Il détermine le
 * sens de la contrainte et sa force. Ajouter un mode se fait ici, puis dans
 * la copie : ni la base, ni le générateur, ni l'interface n'ont à changer.
 */
export const RULE_MODES = [
  {
    key: 'together',
    kind: 'must',
    strict: true,
    labelKey: 'ruleMode.together',
    descriptionKey: 'ruleMode.togetherHelp',
    shortLabelKey: 'ruleMode.togetherShort',
    tone: 'ok'
  },
  {
    key: 'apart',
    kind: 'must_not',
    strict: true,
    labelKey: 'ruleMode.apart',
    descriptionKey: 'ruleMode.apartHelp',
    shortLabelKey: 'ruleMode.apartShort',
    tone: 'neutral'
  },
  {
    key: 'preferTogether',
    kind: 'must',
    strict: false,
    labelKey: 'ruleMode.preferTogether',
    descriptionKey: 'ruleMode.preferTogetherHelp',
    shortLabelKey: 'ruleMode.preferTogetherShort',
    tone: 'ice'
  },
  {
    key: 'preferApart',
    kind: 'must_not',
    strict: false,
    labelKey: 'ruleMode.preferApart',
    descriptionKey: 'ruleMode.preferApartHelp',
    shortLabelKey: 'ruleMode.preferApartShort',
    tone: 'ice'
  }
] as const satisfies readonly {
  key: string;
  kind: PairRuleKind;
  strict: boolean;
  labelKey: I18nKey;
  descriptionKey: I18nKey;
  shortLabelKey: I18nKey;
  tone: 'neutral' | 'ok' | 'ice';
}[];

export type RuleMode = (typeof RULE_MODES)[number]['key'];

export const RULE_MODE_KEYS = RULE_MODES.map((mode) => mode.key) as [RuleMode, ...RuleMode[]];


export function ruleModeDefinition(mode: RuleMode) {
  return RULE_MODES.find((entry) => entry.key === mode);
}

export function ruleModeFor(kind: PairRuleKind, strict: boolean): RuleMode {
  const match = RULE_MODES.find((entry) => entry.kind === kind && entry.strict === strict);
  return match?.key ?? (kind === 'must' ? 'together' : 'apart');
}
