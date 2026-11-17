/**
 * Le cache court de la fiche joueur. Une entrée appartient à une portée de
 * capacités : la même fiche chargée avec les notes n'est jamais resservie à
 * un lecteur qui n'y a plus droit, même dans la même session.
 */
export type PeekCacheEntry<T> = { at: number; view: T };
export type PeekCache<T> = Record<string, PeekCacheEntry<T>>;

function keyFor(scope: string, playerId: string): string {
	return `${scope}\u0000${playerId}`;
}

export function readPeekCache<T>(
	cache: PeekCache<T>,
	scope: string,
	playerId: string,
	now: number,
	ttl: number
): T | null {
	const entry = cache[keyFor(scope, playerId)];
	if (!entry || now - entry.at >= ttl) return null;
	return entry.view;
}

export function writePeekCache<T>(
	cache: PeekCache<T>,
	scope: string,
	playerId: string,
	view: T,
	now: number
): void {
	cache[keyFor(scope, playerId)] = { at: now, view };
}

export function clearPeekCache<T>(cache: PeekCache<T>): void {
	for (const key of Object.keys(cache)) delete cache[key];
}
