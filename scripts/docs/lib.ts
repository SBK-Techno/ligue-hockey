export type TocEntry = { depth: number; text: string; id: string };

const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'"
};

function decodeEntities(value: string): string {
	return value.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

function plainText(html: string): string {
	return decodeEntities(html.replace(/<[^>]*>/g, '')).trim();
}

export function slugify(text: string): string {
	const slug = plainText(text)
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'section';
}

export function addHeadingIds(html: string): { html: string; toc: TocEntry[] } {
	const toc: TocEntry[] = [];
	const used = new Map<string, number>();
	const output = html.replace(/<h([23])>(.*?)<\/h\1>/gs, (_match, depth: string, inner: string) => {
		const base = slugify(inner);
		const seen = used.get(base) ?? 0;
		used.set(base, seen + 1);
		const id = seen === 0 ? base : `${base}-${seen + 1}`;
		toc.push({ depth: Number(depth), text: plainText(inner), id });
		return `<h${depth} id="${id}">${inner}</h${depth}>`;
	});
	return { html: output, toc };
}

export type RewriteOptions = {
	slugs: Map<string, string>;
	repositoryUrl: string;
};

function normalizeTarget(target: string): string {
	return target.replace(/^\.\//, '');
}

function rawUrl(repositoryUrl: string, path: string): string {
	return `${repositoryUrl.replace('https://github.com/', 'https://raw.githubusercontent.com/')}/main/${path}`;
}

export function rewriteLinks(html: string, options: RewriteOptions): string {
	const withLinks = html.replace(
		/(<a\b[^>]*?\bhref=")([^"]*)(")/g,
		(_match, before: string, href: string, after: string) => {
			if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
				return `${before}${href}${after}`;
			}
			const [target, fragment] = href.split('#');
			const normalized = normalizeTarget(target);
			const slug = options.slugs.get(normalized);
			const next = slug
				? `${slug}.html${fragment ? `#${fragment}` : ''}`
				: `${options.repositoryUrl}/blob/main/${normalized}${fragment ? `#${fragment}` : ''}`;
			return `${before}${next}${after}`;
		}
	);

	return withLinks.replace(
		/(<img\b[^>]*?\bsrc=")([^"]*)(")/g,
		(_match, before: string, src: string, after: string) => {
			if (!src || src.startsWith('assets/') || /^[a-z][a-z0-9+.-]*:/i.test(src)) {
				return `${before}${src}${after}`;
			}
			return `${before}${rawUrl(options.repositoryUrl, normalizeTarget(src))}${after}`;
		}
	);
}

export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}
