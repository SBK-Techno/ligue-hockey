import type { I18nKey } from '#config/i18n/fr.ts';
import { t } from '#lib/shared/i18n/index.ts';

/**
 * Le titre de document par route. Une page de détail fournit le titre de son
 * propre contenu (la date du match, le nom du joueur) par `detailTitle`; le
 * résolveur est le seul endroit qui compose le suffixe de marque. Les préfixes
 * restent ordonnés du plus précis au plus général.
 */
const PAGE_TITLES: ReadonlyArray<readonly [string, I18nKey]> = [
	['/admin/joueurs', 'admin.players'],
	['/admin/matchs', 'admin.games'],
	['/admin/regles', 'admin.rules'],
	['/admin/soldes', 'admin.balances'],
	['/admin/parametres', 'admin.settings'],
	['/admin/lieux', 'admin.locations'],
	['/admin/evaluations', 'admin.evaluationsSeason'],
	['/admin', 'admin.title'],
	['/matchs', 'games.title'],
	['/remplacants', 'subs.title'],
	['/discussion', 'nav.chat'],
	['/notifications', 'notifications.title'],
	['/solde', 'balance.title'],
	['/profil', 'nav.profile'],
	['/connexion', 'auth.title'],
	['/mot-de-passe-oublie', 'auth.reset.title'],
	['/reinitialiser-mot-de-passe', 'invite.title']
];

export type PageTitleInput = {
	pathname: string;
	brandName: string;
	shortName: string;
	/** Le h1 de la page de détail, déjà mis en forme par sa route. */
	detail?: string | null;
};

export function resolvePageTitle({
	pathname,
	brandName,
	shortName,
	detail
}: PageTitleInput): string {
	if (pathname === '/') return brandName;
	if (detail) return `${detail} · ${shortName}`;
	const match = PAGE_TITLES.find(
		([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
	return match ? `${t(match[1])} · ${shortName}` : brandName;
}
