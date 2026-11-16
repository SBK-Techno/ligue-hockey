export const SITE_NAME = 'Ligue de hockey du dimanche matin';
export const DEFAULT_SITE_URL = 'https://sbk-techno.github.io/ligue-hockey';
export const REPOSITORY_URL = 'https://github.com/SBK-Techno/ligue-hockey';

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
		description:
			'Horaire, présences, équipes équilibrées, remplaçants et paiements de la ligue.',
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
