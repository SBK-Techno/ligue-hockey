import { clock } from '#lib/shared/time/clock.ts';

type Bucket = {
	count: number;
	resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function prune(now: number): void {
	if (buckets.size < MAX_BUCKETS) return;
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}
}

export function tooManyAttempts(key: string, limit: number): boolean {
	const now = clock.nowMs();
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		if (bucket) buckets.delete(key);
		return false;
	}
	return bucket.count >= limit;
}

export function recordAttempt(key: string, windowMs: number): void {
	const now = clock.nowMs();
	prune(now);
	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return;
	}
	bucket.count += 1;
}

export function clearAttempts(key: string): void {
	buckets.delete(key);
}
