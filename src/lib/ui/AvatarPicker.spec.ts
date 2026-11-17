import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { legendsForPosition } from '#config/legends.ts';
import { t } from '#lib/shared/i18n/index.ts';
import AvatarPicker from './AvatarPicker.svelte';

describe('sélecteur d’identité', () => {
	it('n’affiche qu’une catégorie, les légendes du poste', () => {
		const { body } = render(AvatarPicker, {
			props: { selected: 'legende-lafleur', position: 'forward' }
		});

		expect((body.match(/<h3/g) ?? []).length).toBe(1);
		expect(body).toContain(t('profile.legendsTitle'));
		expect(body).not.toContain('Visages de la ligue');
		expect((body.match(/name="avatarId"/g) ?? []).length).toBe(
			legendsForPosition('forward').length
		);
		expect(body).not.toContain('value="capitaine-navy"');
	});

	it('couvre chaque poste avec les légendes seules', () => {
		for (const position of ['forward', 'defense', 'goalie'] as const) {
			const { body } = render(AvatarPicker, {
				props: { selected: legendsForPosition(position)[0]!.id, position }
			});

			expect((body.match(/name="avatarId"/g) ?? []).length, position).toBe(
				legendsForPosition(position).length
			);
		}
	});

	it('garde l’identité de la ligue enregistrée comme un seul choix courant', () => {
		const { body } = render(AvatarPicker, {
			props: { selected: 'capitaine-navy', position: 'defense' }
		});

		expect(body).toContain('value="capitaine-navy"');
		expect(body).toContain(t('profile.identityCurrent'));
		expect((body.match(/value="capitaine-navy"/g) ?? []).length).toBe(1);
		expect((body.match(/<h3/g) ?? []).length).toBe(1);
	});

	it('montre une légende prise sans écrire « Indisponible »', () => {
		const { body } = render(AvatarPicker, {
			props: {
				selected: 'legende-lafleur',
				position: 'forward',
				taken: ['legende-beliveau']
			}
		});
		const taken = body.match(/<label[^>]*data-taken="true"[^>]*>[\s\S]*?<\/label>/)?.[0] ?? '';

		expect(taken).toContain('value="legende-beliveau"');
		expect(taken).toContain('disabled');
		expect(taken).toContain('grayscale');
		expect(taken).toContain('<svg');
		expect(body).not.toContain('Indisponible');
	});

	it('garde une légende enregistrée hors poste, visible et signalée', () => {
		const { body } = render(AvatarPicker, {
			props: { selected: 'legende-roy', position: 'forward' }
		});

		expect(body).toContain('value="legende-roy"');
		expect(body).toContain(t('profile.legendMismatch'));
		expect(body.match(new RegExp(t('profile.legendMismatch'), 'g'))).toHaveLength(1);
		expect(body).not.toContain('value="legende-harvey"');
	});

	it('ne signale aucun décalage quand la légende correspond au poste', () => {
		const { body } = render(AvatarPicker, {
			props: { selected: 'legende-roy', position: 'goalie' }
		});

		expect(body).toContain('value="legende-roy"');
		expect(body).not.toContain(t('profile.legendMismatch'));
	});

	it('laisse le nom respirer au lieu de le tronquer', () => {
		const { body } = render(AvatarPicker, {
			props: { selected: 'legende-lafleur', position: 'forward' }
		});

		expect(body).toContain('break-words');
		expect(body).not.toContain('truncate');
		expect(body).not.toContain('sm:grid-cols-2');
	});

	it('n’affiche plus la note d’hommage', () => {
		const { body } = render(AvatarPicker, {
			props: { selected: 'legende-lafleur', position: 'forward' }
		});

		expect(body).not.toContain('Hommage non officiel');
		expect(body).not.toContain('sans affiliation');
	});
});
