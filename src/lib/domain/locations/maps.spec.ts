import { describe, expect, it } from 'vitest';
import { MAP_URL_TEMPLATE, mapUrlFor, mapUrlForCoordinates } from '#config/maps.ts';

describe('mapUrlFor', () => {
	it('returns the explicit map URL first', () => {
		expect(mapUrlFor('12 rue Principale', 'https://example.test/carte')).toBe(
			'https://example.test/carte'
		);
	});

	it('fills the provider template with an encoded address', () => {
		const address = '12 rue de l’Église, Québec';
		expect(MAP_URL_TEMPLATE).toContain('{query}');
		expect(mapUrlFor(address, null)).toBe(
			MAP_URL_TEMPLATE.replace('{query}', encodeURIComponent(address))
		);
	});

	it('returns null when there is neither an address nor an explicit URL', () => {
		expect(mapUrlFor(null, null)).toBeNull();
		expect(mapUrlFor('   ', '  ')).toBeNull();
	});
});

describe('mapUrlForCoordinates', () => {
	it('opens the map on the selected point', () => {
		expect(mapUrlForCoordinates(45.50884, -73.58781)).toBe(
			'https://www.openstreetmap.org/?mlat=45.50884&mlon=-73.58781#map=17/45.50884/-73.58781'
		);
	});

	it('refuses impossible coordinates', () => {
		expect(mapUrlForCoordinates(91, 0)).toBeNull();
		expect(mapUrlForCoordinates(0, 181)).toBeNull();
		expect(mapUrlForCoordinates(Number.NaN, 0)).toBeNull();
	});
});
