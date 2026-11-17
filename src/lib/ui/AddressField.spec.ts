import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import AddressField from './AddressField.svelte';

describe('champ d’adresse', () => {
	it('garde le lien de carte en champ caché', () => {
		const mapUrl = 'https://www.openstreetmap.org/?mlat=46.34320&mlon=-72.54710';
		const { body } = render(AddressField, {
			props: { id: 'adresse', value: '845 boulevard des Estacades', mapUrl }
		});

		expect(body).toContain('name="address"');
		expect(body).toContain('name="mapUrl"');
		expect(body).toContain(
			'name="mapUrl" value="https://www.openstreetmap.org/?mlat=46.34320&amp;mlon=-72.54710"'
		);
		expect(body).toContain('role="combobox"');
		expect(body).toContain(t('admin.locationAddressHelp'));
		expect(body).not.toContain('Lien de la carte');
		expect(body).not.toContain('type="url"');
	});

	it('laisse le lien vide quand l’adresse n’a pas été choisie', () => {
		const { body } = render(AddressField, {
			props: { id: 'adresse', value: '12 rue Principale' }
		});

		expect(body).toContain('name="mapUrl" value=""');
	});
});
