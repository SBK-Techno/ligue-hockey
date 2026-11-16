import type { I18nKey } from './i18n/fr.ts';

export const PAYMENT_METHODS = [
  { key: 'etransfer', labelKey: 'payment.etransfer' },
  { key: 'cash', labelKey: 'payment.cash' },
  { key: 'card', labelKey: 'payment.card' },
  { key: 'other', labelKey: 'payment.other' }
] as const satisfies readonly { key: string; labelKey: I18nKey }[];

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['key'];

export const PAYMENT_METHOD_KEYS = PAYMENT_METHODS.map(
  (method) => method.key
) as [PaymentMethod, ...PaymentMethod[]];

export function paymentDefinition(method: PaymentMethod) {
  const definition = PAYMENT_METHODS.find((entry) => entry.key === method);
  if (!definition) {
    throw new Error(`Unknown payment method: ${method}`);
  }
  return definition;
}
