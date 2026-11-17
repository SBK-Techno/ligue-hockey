import { redirect } from '@sveltejs/kit';
import { unreadCount } from '#lib/domain/notifications/service.ts';
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
			avatarId: null
		};
	}

	if (url.pathname === '/connexion') {
		redirect(303, '/');
	}

	const profile = findOwnProfile(actor);
	return {
		actor,
		unread: unreadCount(actor),
		hasPlayerProfile: profile !== null,
		isSubstitute: profile?.isSubstitute ?? false,
		avatarId: profile?.avatarId ?? null
	};
};
