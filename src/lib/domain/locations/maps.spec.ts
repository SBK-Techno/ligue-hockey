import { describe, expect, it } from 'vitest';
import { MAP_URL_TEMPLATE, mapUrlFor } from '#config/maps.ts';

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
