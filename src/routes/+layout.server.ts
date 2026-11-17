import { redirect } from '@sveltejs/kit';
import { unreadCount } from '#lib/domain/notifications/service.ts';
import {
	mobileSurfaces,
	primarySurfaces,
	visibleSurfaces
} from '#lib/domain/auth/surfaces.ts';
import { ACCOUNT_LIMITS } from '#config/account.ts';
import { roleDefinition } from '#config/roles.ts';
import { peekScope } from '#lib/domain/players/peek.ts';
import { findOwnProfile } from '#lib/domain/players/service.ts';

const PUBLIC_PREFIXES = ['/connexion', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe'];

function isPublic(pathname: string): boolean {
	return PUBLIC_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
}

export const load = ({ locals, url }: { locals: App.Locals; url: URL }) => {
	const actor = locals.actor;

	if (actor.kind === 'anonymous') {
		if (!isPublic(url.pathname)) {
			const next = `${url.pathname}${url.search}`;
			redirect(303, `/connexion?prochaine=${encodeURIComponent(next)}`);
		}
		return {
			actor,
			unread: 0,
			hasPlayerProfile: false,
			isSubstitute: false,
			avatarId: null,
			peekScope: peekScope(actor),
			nav: {
				primary: [],
				mobile: [],
				account: null,
				roleLabelKey: 'admin.role.player' as const,
				unreadCap: ACCOUNT_LIMITS.unreadBadgeMax
			}
		};
	}

	if (url.pathname === '/connexion') {
		redirect(303, '/');
	}

	const profile = findOwnProfile(actor);
	const surfaces = visibleSurfaces(actor);
	return {
		actor,
		unread: unreadCount(actor),
		hasPlayerProfile: profile !== null,
		isSubstitute: profile?.isSubstitute ?? false,
		avatarId: profile?.avatarId ?? null,
		peekScope: peekScope(actor),
		// L'autorisation est calculée côté serveur; le navigateur ne reçoit que
		// les entrées déjà visibles, jamais la table des capacités.
		nav: {
			primary: primarySurfaces(actor),
			mobile: mobileSurfaces(actor),
			account: surfaces.find((surface) => surface.key === 'account') ?? null,
			roleLabelKey: roleDefinition(actor.role)?.labelKey ?? 'admin.role.player',
			unreadCap: ACCOUNT_LIMITS.unreadBadgeMax
		}
	};
};
