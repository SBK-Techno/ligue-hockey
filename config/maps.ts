/**
 * Provider-agnostic map links. Swapping the provider means editing this
 * template only; no page or component knows the host.
 */
export const MAP_URL_TEMPLATE = 'https://www.openstreetmap.org/search?query={query}';

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
