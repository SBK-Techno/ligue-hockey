import { clock } from '#lib/shared/time/clock.ts';

type Bucket = {
	count: number;
	resetAt: number;
};

const buckets = new Map<string, Bucket>();
/** La borne dure du registre : au-delà, la plus ancienne clé cède sa place. */
export const MAX_BUCKETS = 10_000;

/**
 * Sous la borne, rien n'est balayé : la carte reste petite et une clé expirée
 * ne coûte qu'un remplacement quand la borne est atteinte. Au-delà, les clés
 * expirées partent d'abord; l'éviction LRU prend le relais si elles manquent.
 */
function prune(now: number): void {
	if (buckets.size < MAX_BUCKETS) return;
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}
}

/** Une lecture ou une écriture rend la clé la plus récente du registre. */
function touch(key: string, bucket: Bucket): void {
	buckets.delete(key);
	buckets.set(key, bucket);
}

function evictOldest(): void {
	while (buckets.size >= MAX_BUCKETS) {
		const oldest = buckets.keys().next().value;
		if (oldest === undefined) return;
		buckets.delete(oldest);
	}
}

export function tooManyAttempts(key: string, limit: number): boolean {
	const now = clock.nowMs();
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		if (bucket) buckets.delete(key);
		return false;
	}
	touch(key, bucket);
	return bucket.count >= limit;
}

export function recordAttempt(key: string, windowMs: number): void {
	const now = clock.nowMs();
	prune(now);
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		if (bucket) buckets.delete(key);
		evictOldest();
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return;
	}
	bucket.count += 1;
	touch(key, bucket);
}

export function clearAttempts(key: string): void {
	buckets.delete(key);
}

/** Pour les tests seulement : aucun état ne survit à une remise à zéro. */
export function resetThrottle(): void {
	buckets.clear();
}

export function throttleSize(): number {
	return buckets.size;
}
