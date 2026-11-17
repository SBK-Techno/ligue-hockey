import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import IdentityDisclosure from './IdentityDisclosure.svelte';

describe('divulgation de l’identité', () => {
	it('garde le sélecteur replié et l’identité courante visible', () => {
		const { body } = render(IdentityDisclosure, {
			props: {
				selected: 'legende-lafleur',
				position: 'forward',
				player: { fullName: 'Karim Haddad', userId: 'player-1' },
				legendName: 'Guy Lafleur'
			}
		});

		expect(body).toMatch(/<details(?![^>]*\bopen\b)[^>]*>/);
		expect(body).toContain('Guy Lafleur');
		expect(body).toContain(t('profile.identityChange'));
		expect(body).toContain('name="avatarId"');
	});

	it('nomme un visage de la ligue quand aucune légende n’est choisie', () => {
		const { body } = render(IdentityDisclosure, {
			props: {
				selected: 'avatar-1',
				position: 'defense',
				player: { fullName: 'Karim Haddad', userId: 'player-1' },
				legendName: null
			}
		});

		expect(body).toContain(t('profile.avatarLeague'));
		expect(body).toContain('name="avatarId"');
	});

	it('suit le contexte du responsable qui change l’identité d’un joueur', () => {
		const { body } = render(IdentityDisclosure, {
			props: {
				selected: 'avatar-1',
				position: 'defense',
				player: { fullName: 'Karim Haddad', userId: 'player-1' },
				legendName: null,
				actionLabel: t('admin.identityChange'),
				help: t('admin.avatarHelp'),
				legendsTitle: t('admin.legendsTitle'),
				legendsHelp: t('admin.legendsHelp')
			}
		});

		expect(body).toContain(t('admin.identityChange'));
		expect(body).not.toContain(t('profile.identityChange'));
		expect(body).toContain(t('admin.avatarHelp'));
		expect(body).toContain(t('admin.legendsTitle'));
		expect(body).toContain(t('admin.legendsHelp'));
	});
});
