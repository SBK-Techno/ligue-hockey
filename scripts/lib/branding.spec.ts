import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePalette } from './palette.ts';

describe('generated app shell', () => {
	it('paints the canonical paper colour before the stylesheet loads', () => {
		const palette = parsePalette(readFileSync('src/lib/ui/tokens.css', 'utf8'));
		const shell = readFileSync('src/app.html', 'utf8');
		expect(shell).toContain(`style="background-color: ${palette.paper}; color-scheme: light"`);
	});
});
