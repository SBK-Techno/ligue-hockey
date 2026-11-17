import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import Avatar from './Avatar.svelte';

const player = {
	fullName: 'Guy Lafleur',
	userId: 'joueur-test',
	avatarId: 'legende-lafleur'
};

describe('avatar', () => {
	it('remplit le cadre de l’appelant sans sa propre bordure', () => {
		const { body } = render(Avatar, { props: { player, fill: true } });

		expect(body).toContain('identity-portrait');
		expect(body).toContain('width: 100%');
		expect(body).toContain('height: 100%');
		expect(body).not.toContain('avatar-frame');
		expect(body).toContain('aria-hidden="true"');
	});

	it('garde sa taille et son cadre par défaut', () => {
		const { body } = render(Avatar, { props: { player } });

		expect(body).toContain('width: 48px');
		expect(body).toContain('height: 48px');
		expect(body).toContain('avatar-frame');
	});

	it('nomme le portrait quand il ouvre une fiche', () => {
		const { body } = render(Avatar, {
			props: { player, decorative: false, fill: true }
		});
		const opening = body.match(/<span[^>]*role="button"[^>]*>/)?.[0] ?? '';

		expect(opening).toContain(
			`aria-label="${t('profile.avatarOpen', { name: player.fullName })}"`
		);
		expect(opening).toContain('data-player-peek="click"');
		expect(opening).not.toContain('aria-hidden');
	});
});
