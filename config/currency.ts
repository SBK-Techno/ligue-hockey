/**
 * La ligue encaisse en dollars canadiens, sans exception. Une seule constante
 * possède la devise; aucun réglage ne peut la changer.
 */
export const CURRENCY = 'CAD' as const;

export type Currency = typeof CURRENCY;
