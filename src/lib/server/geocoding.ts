import { LOCATION_LIMITS } from '#config/games.ts';
import { ADDRESS_SEARCH, mapUrlForCoordinates } from '#config/maps.ts';
import { AppError } from '#lib/shared/errors.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import { clock } from '#lib/shared/time/clock.ts';

export type AddressSuggestion = {
	id: string;
	label: string;
	mapUrl: string;
};

type CacheEntry = {
	at: number;
	results: AddressSuggestion[];
};

const cache = new Map<string, CacheEntry>();

function text(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return '';
}

function coordinate(value: unknown): number {
	return typeof value === 'number' ? value : Number.NaN;
}

/**
 * Photon returns GeoJSON features. The label is assembled from the address
 * parts, never from a provider-specific display string, so a provider swap only
 * changes this adapter.
 */
function normalize(payload: unknown): AddressSuggestion[] {
	if (!payload || typeof payload !== 'object') return [];
	const features = (payload as { features?: unknown }).features;
	if (!Array.isArray(features)) return [];

	const results: AddressSuggestion[] = [];
	const seen = new Set<string>();

	for (const feature of features) {
		if (!feature || typeof feature !== 'object') continue;
		const properties = (feature as { properties?: unknown }).properties;
		const geometry = (feature as { geometry?: unknown }).geometry;
		if (!properties || typeof properties !== 'object') continue;
		const props = properties as Record<string, unknown>;
		const coordinates = (geometry as { coordinates?: unknown } | undefined)?.coordinates;
		if (!Array.isArray(coordinates)) continue;

		const latitude = coordinate(coordinates[1]);
		const longitude = coordinate(coordinates[0]);
		const mapUrl = mapUrlForCoordinates(latitude, longitude);
		if (!mapUrl) continue;

		const street = [text(props.housenumber), text(props.street)]
			.filter(Boolean)
			.join(' ');
		const lineOne = street || text(props.name);
		const locality =
			text(props.city) ||
			text(props.town) ||
			text(props.village) ||
			text(props.municipality) ||
			text(props.county);
		const region = text(props.state) || text(props.region);
		const lineTwo = [locality, region, text(props.postcode), text(props.country)]
			.filter(Boolean)
			.join(', ');
		const rawLabel = [lineOne, lineTwo].filter(Boolean).join(', ');
		if (!rawLabel) continue;
		// The address field and the schema share one bound: a provider label must
		// stay savable instead of failing the form with no visible URL to fix.
		const label = rawLabel.slice(0, LOCATION_LIMITS.addressMax).trimEnd();

		const id =
			[text(props.osm_type), text(props.osm_id)].filter(Boolean).join(':') ||
			`${latitude},${longitude}`;
		const dedupeKey = `${label.toLowerCase()}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`;
		if (seen.has(dedupeKey)) continue;
		seen.add(dedupeKey);
		results.push({ id, label, mapUrl });
		if (results.length >= ADDRESS_SEARCH.limit) break;
	}

	return results;
}

function pruneCache(now: number): void {
	if (cache.size < ADDRESS_SEARCH.cacheMaxEntries) return;
	for (const [key, entry] of cache) {
		if (now - entry.at >= ADDRESS_SEARCH.cacheTtlMs) cache.delete(key);
	}
	while (cache.size >= ADDRESS_SEARCH.cacheMaxEntries) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) return;
		cache.delete(oldest);
	}
}

/**
 * The one address search adapter. The browser calls the internal route; this
 * module owns the provider request, timeout, cache and normalization.
 */
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
	const key = query.trim().toLowerCase();
	const now = clock.nowMs();
	const cached = cache.get(key);
	if (cached && now - cached.at < ADDRESS_SEARCH.cacheTtlMs) {
		cache.delete(key);
		cache.set(key, cached);
		return cached.results;
	}

	const url = new URL(ADDRESS_SEARCH.endpoint);
	url.searchParams.set('q', key);
	url.searchParams.set('limit', String(ADDRESS_SEARCH.limit));
	url.searchParams.set('lang', ADDRESS_SEARCH.language);

	let response: Response;
	try {
		response = await fetch(url, {
			headers: { accept: 'application/json', 'user-agent': 'LigueHockey/1.0' },
			signal: AbortSignal.timeout(ADDRESS_SEARCH.timeoutMs)
		});
	} catch (cause) {
		logger.warn('address.search_unreachable', { error: cause });
		throw new AppError('INTERNAL', {
			key: 'admin.addressSearchUnavailable',
			cause
		});
	}

	if (!response.ok) {
		logger.warn('address.search_refused', { status: response.status });
		throw new AppError('INTERNAL', {
			key: 'admin.addressSearchUnavailable'
		});
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch (cause) {
		logger.warn('address.search_invalid_payload', { error: cause });
		throw new AppError('INTERNAL', {
			key: 'admin.addressSearchUnavailable',
			cause
		});
	}

	const results = normalize(payload);
	pruneCache(now);
	cache.set(key, { at: now, results });
	return results;
}

/** Pour les tests seulement : aucun résultat ne survit à une remise à zéro. */
export function clearAddressCache(): void {
	cache.clear();
}
