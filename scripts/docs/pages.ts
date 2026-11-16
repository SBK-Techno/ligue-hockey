import { readFileSync } from 'node:fs';

function readJson<T>(relativePath: string): T {
	return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as T;
}

const project = readJson<{ repository: { url: string } }>('../../package.json');
export const BRANDING = readJson<{
	name: string;
	locale: string;
	description: string;
}>('../../config/branding.json');

export const REPOSITORY_URL = project.repository.url.replace(/\.git$/, '');
export const DEFAULT_BRANCH = 'main';

function pagesUrl(repositoryUrl: string): string {
	const url = new URL(repositoryUrl);
	if (url.hostname !== 'github.com') {
		throw new Error(`La publication des docs exige GitHub Pages: ${repositoryUrl}`);
	}
	const [owner, repo] = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
	if (!owner || !repo) throw new Error(`Dépôt invalide: ${repositoryUrl}`);
	return `https://${owner.toLowerCase()}.github.io/${repo}`;
}

export const DEFAULT_SITE_URL = pagesUrl(REPOSITORY_URL);

export type DocPage = {
	slug: string;
	title: string;
	nav: string;
	description: string;
	source: string;
};

export const pages: DocPage[] = [
	{
		slug: 'index',
		title: 'Présentation',
		nav: 'Présentation',
		description: BRANDING.description,
		source: 'README.md'
	},
	{
		slug: 'architecture',
		title: 'Architecture',
		nav: 'Architecture',
		description: 'Frontières de modules, flux de données et décisions techniques.',
		source: 'ARCHITECTURE.md'
	},
	{
		slug: 'exploitation',
		title: 'Exploitation',
		nav: 'Exploitation',
		description: 'Déploiement, sauvegarde, notifications et dépannage.',
		source: 'OPERATIONS.md'
	},
	{
		slug: 'contribuer',
		title: 'Contribuer',
		nav: 'Contribuer',
		description: 'Installation, commandes, convention de branches et publication.',
		source: 'CONTRIBUTING.md'
	},
	{
		slug: 'securite',
		title: 'Sécurité',
		nav: 'Sécurité',
		description: 'Versions soutenues et signalement d’une vulnérabilité.',
		source: 'SECURITY.md'
	}
];
