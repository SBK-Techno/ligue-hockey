import { redirect } from '@sveltejs/kit';
import { unreadCount } from '#lib/domain/notifications/service.ts';

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
		return { actor, unread: 0 };
	}

	if (url.pathname === '/connexion') {
		redirect(303, '/');
	}

	return { actor, unread: unreadCount(actor) };
};
