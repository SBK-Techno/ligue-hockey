import { redirect } from '@sveltejs/kit';
import { signOut } from '#lib/domain/auth/service.ts';

export const POST = async ({ request }: { request: Request }) => {
	await signOut(request.headers);
	redirect(303, '/connexion');
};
