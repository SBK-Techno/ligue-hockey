import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	GENERATED_ASSET_RETENTION_DAYS,
	isRetainedHashedAsset
} from './asset-retention.ts';
import { contentHashedPath, writeGeneratedFiles } from './branding.ts';
import { IDENTITIES } from '#config/identities.ts';
import {
	allColourKeys,
	colourFamilies,
	parseColourTokens,
	parsePalette
} from './palette.ts';

describe('generated app shell', () => {
	it('paints the canonical paper colour before the stylesheet loads', () => {
		const palette = parsePalette(readFileSync('src/lib/ui/tokens.css', 'utf8'));
		const shell = readFileSync('src/app.html', 'utf8');
		expect(shell).toContain(`style="background-color: ${palette.paper}; color-scheme: light"`);
	});
});

describe('catalogue des couleurs', () => {
	const css = readFileSync('src/lib/ui/tokens.css', 'utf8');

	it('déclare exactement les jetons des trois familles', () => {
		const declared = [...parseColourTokens(css).keys()].sort();
		const families = colourFamilies(IDENTITIES.length);

		expect(declared).toEqual(allColourKeys(IDENTITIES.length).sort());
		expect(families.palette).toHaveLength(21);
		expect(families.player).toHaveLength(IDENTITIES.length);
		expect(families.avatar).toHaveLength(18);
	});

	it('donne une couleur distincte à chaque identité', () => {
		const tokens = parseColourTokens(css);
		const values = IDENTITIES.map((identity) => tokens.get(`player-${identity.color}`));

		for (const value of values) expect(value).toBeDefined();
		expect(new Set(values).size).toBe(IDENTITIES.length);
	});

	it('extrait toute la palette sémantique pour les surfaces générées', () => {
		const palette = parsePalette(css);
		expect(Object.keys(palette)).toHaveLength(21);
		expect(palette['on-brand']).toMatch(/^#[0-9a-f]{6}$/);
		expect(palette['team-black']).toMatch(/^#[0-9a-f]{6}$/);
	});
});

describe('actifs générés nommés par contenu', () => {
	it('suffixe le chemin social avec le contenu', () => {
		const digest = createHash('sha256').update('octets').digest('hex').slice(0, 12);
		expect(contentHashedPath('/social/apercu.jpg', 'octets')).toBe(
			`/social/apercu-${digest}.jpg`
		);
	});

	it('garde un actif remplacé pendant la fenêtre de cache, puis le supprime', async () => {
		const root = await mkdtemp(join(tmpdir(), 'lhdm-assets-'));
		const dir = join(root, 'static/icons');
		await mkdir(dir, { recursive: true });
		const oldName = `old-${'a'.repeat(12)}.png`;
		const recentName = `recent-${'b'.repeat(12)}.png`;
		const keptName = `keep-${'c'.repeat(12)}.png`;
		for (const name of [oldName, recentName]) {
			await writeFile(join(dir, name), name);
		}

		const now = Date.UTC(2026, 10, 16);
		const day = 24 * 60 * 60 * 1000;
		const old = now - (GENERATED_ASSET_RETENTION_DAYS + 1) * day;
		const recent = now - day;
		await utimes(join(dir, oldName), old / 1000, old / 1000);
		await utimes(join(dir, recentName), recent / 1000, recent / 1000);

		await writeGeneratedFiles(
			root,
			[{ path: `static/icons/${keptName}`, contents: 'nouveau' }],
			now
		);

		await expect(stat(join(dir, oldName))).rejects.toThrow();
		await expect(stat(join(dir, recentName))).resolves.toBeDefined();
		await expect(stat(join(dir, keptName))).resolves.toBeDefined();
	});

	it('refuse un nom daté dont le contenu ne correspond pas', () => {
		const digest = createHash('sha256').update('vrai').digest('hex');
		const fake = createHash('sha256').update('faux').digest('hex');
		expect(isRetainedHashedAsset(`static/icons/x-${digest.slice(0, 12)}.png`, digest)).toBe(
			true
		);
		expect(isRetainedHashedAsset(`static/icons/x-${digest.slice(0, 12)}.png`, fake)).toBe(
			false
		);
		expect(isRetainedHashedAsset('static/icons/apercu.jpg', digest)).toBe(false);
	});
});
