import { describe, expect, it } from 'vitest';
import {
	PLAYER_FILTERS,
	playerFiltersUrl,
	readPlayerFilters,
	type PlayerListFilters
} from './filters.ts';

const base = new URL('https://ligue.test/admin/joueurs');

describe('filtres de la liste des joueurs', () => {
	it('lit la recherche et la puce depuis l’URL', () => {
		const filters = readPlayerFilters(new URLSearchParams('q=karim&filtre=subs'));

		expect(filters).toEqual({ query: 'karim', filter: 'subs' });
	});

	it('restitue les deux filtres après un retour du navigateur', () => {
		const filters: PlayerListFilters = { query: 'karim', filter: 'inactive' };
		const restored = readPlayerFilters(
			playerFiltersUrl(base, filters).searchParams
		);

		expect(restored).toEqual(filters);
	});

	it('écrit les deux filtres dans l’URL et retire les valeurs par défaut', () => {
		const withFilters = playerFiltersUrl(base, { query: '  karim  ', filter: 'active' });
		expect(withFilters.searchParams.get('q')).toBe('karim');
		expect(withFilters.searchParams.get('filtre')).toBe('active');

		const cleared = playerFiltersUrl(withFilters, { query: '', filter: 'all' });
		expect(cleared.searchParams.has('q')).toBe(false);
		expect(cleared.searchParams.has('filtre')).toBe(false);
	});

	it('ignore une puce inconnue et garde les autres paramètres', () => {
		const url = playerFiltersUrl(
			new URL('https://ligue.test/admin/joueurs?archive=1'),
			{ query: '', filter: 'all' }
		);

		expect(readPlayerFilters(new URLSearchParams('filtre=inconnu')).filter).toBe('all');
		expect(url.searchParams.get('archive')).toBe('1');
		expect(PLAYER_FILTERS).toEqual(['all', 'active', 'subs', 'inactive']);
	});
});
