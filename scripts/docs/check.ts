import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDocs } from './build.ts';
import { BRANDING, pages } from './pages.ts';

const result = buildDocs();
const failures: string[] = [];

const htmlFiles = readdirSync(result.output).filter((entry) => entry.endsWith('.html'));
const ids = new Map<string, Set<string>>();

for (const file of htmlFiles) {
	const html = readFileSync(join(result.output, file), 'utf8');
	ids.set(
		file,
		new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]))
	);
}

function stripTags(value: string): string {
	return value
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&[a-z#0-9]+;/gi, ' ');
}

for (const file of htmlFiles) {
	const html = readFileSync(join(result.output, file), 'utf8');
	if (!html.includes(`<html lang="${BRANDING.locale}">`)) {
		failures.push(`${file}: langue ${BRANDING.locale} absente`);
	}
	if (!/<title>[^<]+<\/title>/.test(html)) {
		failures.push(`${file}: titre absent`);
	}
	if (!/<meta name="description" content="[^"]+">/.test(html)) {
		failures.push(`${file}: description absente`);
	}

	for (const match of html.matchAll(/\bhref="([^"]*)"/g)) {
		const href = match[1];
		if (!href) {
			failures.push(`${file}: lien vide`);
			continue;
		}
		if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
		const [target, fragment] = href.split('#');
		const resolved = target || file;
		if (!existsSync(join(result.output, resolved))) {
			failures.push(`${file}: cible absente ${href}`);
			continue;
		}
		if (fragment && !ids.get(resolved)?.has(fragment)) {
			failures.push(`${file}: ancre absente ${href}`);
		}
	}

	for (const match of html.matchAll(/\bsrc="([^"]*)"/g)) {
		const src = match[1];
		if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src)) continue;
		if (!existsSync(join(result.output, src))) {
			failures.push(`${file}: ressource absente ${src}`);
		}
	}

	const text = stripTags(html);
	if (/[\u2013\u2014]/.test(text)) {
		failures.push(`${file}: tiret cadratin ou demi-cadratin interdit`);
	}
}

for (const page of pages) {
	if (!htmlFiles.includes(`${page.slug}.html`)) {
		failures.push(`${page.source}: page ${page.slug}.html absente`);
	}
}

if (failures.length > 0) {
	for (const failure of failures) console.error(`  ${failure}`);
	console.error(`Documentation invalide: ${failures.length} problème(s).`);
	process.exit(1);
}

console.log(`Documentation valide: ${htmlFiles.length} fichiers dans ${result.output}`);
