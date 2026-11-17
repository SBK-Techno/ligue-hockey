/**
 * La recherche et la puce de la liste des joueurs vivent dans l'URL : le
 * retour du navigateur restitue donc les deux filtres avec la page.
 */
export const PLAYER_FILTERS = ['all', 'active', 'subs', 'inactive'] as const;

export type PlayerFilter = (typeof PLAYER_FILTERS)[number];

export type PlayerListFilters = {
	query: string;
	filter: PlayerFilter;
};

/** Le contrat commun d'une URL de page, en lecture seule côté serveur. */
export type SearchParamsReader = { get(name: string): string | null };

export function readPlayerFilters(params: SearchParamsReader): PlayerListFilters {
	const filter =
		PLAYER_FILTERS.find((candidate) => candidate === params.get('filtre')) ?? 'all';
	return { query: params.get('q')?.trim() ?? '', filter };
}

export function playerFiltersUrl(current: string | URL, next: PlayerListFilters): URL {
	const url = new URL(current);
	const query = next.query.trim();
	if (query) url.searchParams.set('q', query);
	else url.searchParams.delete('q');
	if (next.filter === 'all') url.searchParams.delete('filtre');
	else url.searchParams.set('filtre', next.filter);
	return url;
}
