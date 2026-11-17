import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import RatingScale from './RatingScale.svelte';

describe('rendu de l’échelle de note', () => {
	it('laisse les notes se replier dans une colonne étroite', () => {
		const { body } = render(RatingScale, {
			props: { name: 'shot', label: 'Lancer', value: 3 }
		});
		const row = body.match(/<div class="(flex[^"]*items-center[^"]*)">/)?.[1] ?? '';

		expect(row).toContain('flex-wrap');
		expect(body.match(/type="radio"/g)).toHaveLength(5);
	});
});
