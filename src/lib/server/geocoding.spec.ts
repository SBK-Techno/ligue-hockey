import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '#lib/shared/errors.ts';
import { clearAddressCache, searchAddresses } from './geocoding.ts';

function photon(features: unknown[]): Response {
	return new Response(JSON.stringify({ type: 'FeatureCollection', features }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

function feature(properties: Record<string, unknown>, coordinates: [number, number]) {
	return {
		type: 'Feature',
		properties,
		geometry: { type: 'Point', coordinates }
	};
}

describe('recherche d’adresses', () => {
	beforeEach(() => {
		clearAddressCache();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('normalise une adresse et sa carte', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				photon([
					feature(
						{
							osm_type: 'N',
							osm_id: 42,
							housenumber: '845',
							street: 'Boulevard des Estacades',
							city: 'Trois-Rivières',
							state: 'Québec',
							postcode: 'G8T 5V3',
							country: 'Canada'
						},
						[-72.5471, 46.3432]
					)
				])
			)
		);

		const results = await searchAddresses('845 boulevard des Estacades');

		expect(results).toEqual([
			{
				id: 'N:42',
				label:
					'845 Boulevard des Estacades, Trois-Rivières, Québec, G8T 5V3, Canada',
				mapUrl:
					'https://www.openstreetmap.org/?mlat=46.34320&mlon=-72.54710#map=17/46.34320/-72.54710'
			}
		]);
	});

	it('garde le nom d’un lieu sans rue et déduplique les résultats', async () => {
		const place = feature(
			{
				osm_type: 'W',
				osm_id: 7,
				name: 'Aréna du Boisé',
				city: 'Trois-Rivières',
				country: 'Canada'
			},
			[-72.55, 46.35]
		);
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(photon([place, place]))
		);

		const results = await searchAddresses('aréna du boisé');

		expect(results).toHaveLength(1);
		expect(results[0]?.label).toBe('Aréna du Boisé, Trois-Rivières, Canada');
	});

	it('ignore une charge utile sans coordonnées valides', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				photon([
					feature({ name: 'Nulle part' }, [200, 95]),
					{ type: 'Feature', properties: { name: 'Sans géométrie' } }
				])
			)
		);

		await expect(searchAddresses('nulle part')).resolves.toEqual([]);
	});

	it('garde des identifiants distincts pour un même type OSM', async () => {
		const first = feature(
			{ osm_type: 'N', osm_id: 42, name: 'Aréna un', city: 'Trois-Rivières' },
			[-72.54, 46.34]
		);
		const second = feature(
			{ osm_type: 'N', osm_id: 43, name: 'Aréna deux', city: 'Trois-Rivières' },
			[-72.55, 46.35]
		);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(photon([first, second])));

		const results = await searchAddresses('aréna');

		expect(results.map((result) => result.id)).toEqual(['N:42', 'N:43']);
	});

	it('borne une adresse trop longue pour le formulaire', async () => {
		const longName = 'A'.repeat(240);
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				photon([feature({ name: longName }, [-72.54, 46.34])])
			)
		);

		const results = await searchAddresses('adresse longue');

		expect(results[0]?.label).toHaveLength(200);
	});

	it('réutilise le cache pour la même recherche', async () => {
		const fetchMock = vi.fn().mockResolvedValue(photon([]));
		vi.stubGlobal('fetch', fetchMock);

		await searchAddresses('Trois-Rivières');
		await searchAddresses('  trois-rivières  ');

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('signale un fournisseur en panne au lieu de rendre un vide silencieux', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('panne', { status: 503 }))
		);

		try {
			await searchAddresses('Trois-Rivières');
			throw new Error('Aucune erreur reçue');
		} catch (cause) {
			expect(cause).toBeInstanceOf(AppError);
			expect(cause).toMatchObject({ key: 'admin.addressSearchUnavailable' });
		}
	});
});
