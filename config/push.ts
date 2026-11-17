export const PUSH_DELIVERY = {
	ttlSeconds: 3600,
	urgency: 'high',
	endpointMax: 2048,
	keyMax: 512
} as const;

/**
 * Le délai maximal pour obtenir un service worker prêt. `ready` ne rejette
 * jamais : sans borne, la page resterait sur « Chargement… » indéfiniment.
 */
export const PUSH_DEVICE = {
	readyTimeoutMs: 5000
} as const;
