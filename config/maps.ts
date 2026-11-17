/**
 * Provider-agnostic map links and address search. Swapping the provider means
 * editing this module only; no page or component knows the host.
 */
export const MAP_URL_TEMPLATE = 'https://www.openstreetmap.org/search?query={query}';

/**
 * Address autocomplete uses Photon, the OpenStreetMap search service. The
 * server proxy owns the calls so the provider can change, the query can be
 * cached, and no browser talks to a third party directly.
 */
export const ADDRESS_SEARCH = {
	endpoint: 'https://photon.komoot.io/api/',
	language: 'fr',
	limit: 6,
	minChars: 3,
	timeoutMs: 4_000,
	cacheTtlMs: 10 * 60_000,
	cacheMaxEntries: 200
} as const;

export function mapUrlFor(
	address: string | null | undefined,
	explicitUrl: string | null | undefined
): string | null {
	const explicit = explicitUrl?.trim();
	if (explicit) return explicit;

	const query = address?.trim();
	if (!query) return null;

	return MAP_URL_TEMPLATE.replace('{query}', encodeURIComponent(query));
}

/** A selected address gets a marker link so the venue opens at the right spot. */
export function mapUrlForCoordinates(
	latitude: number,
	longitude: number
): string | null {
	if (
		!Number.isFinite(latitude) ||
		!Number.isFinite(longitude) ||
		latitude < -90 ||
		latitude > 90 ||
		longitude < -180 ||
		longitude > 180
	) {
		return null;
	}

	const lat = latitude.toFixed(5);
	const lon = longitude.toFixed(5);
	return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}
