import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

describe('ordre visuel et de focus du tableau de bord', () => {
	it('garde le prochain match avant la liste des tâches dans le DOM', () => {
		const nextGame = source.indexOf("title={t('home.nextGame')}");
		const todo = source.indexOf("title={t('admin.todo')}");

		expect(nextGame).toBeGreaterThan(-1);
		expect(todo).toBeGreaterThan(nextGame);
		expect(source.match(/home\.nextGame/g)).toHaveLength(1);
	});

	it('aligne la grille de bureau sur cet ordre, sans order ni doublon', () => {
		expect(source).toContain(
			`class="lg:col-start-1 lg:row-start-1" title={t('home.nextGame')}`
		);
		expect(source).toContain('lg:col-start-1 {data.permissions.games');
		expect(source).toContain("? 'lg:row-start-2'");
		expect(source).toContain('lg:col-start-2 lg:row-start-1 lg:row-span-2');
		expect(source).not.toMatch(/class="[^"]*\border-/);
	});
});
