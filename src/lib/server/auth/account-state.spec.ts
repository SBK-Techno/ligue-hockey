import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

/**
 * Le plan HTTP de Better Auth n'est pas un second propriétaire des mutations :
 * toute écriture brute est refusée avec l'enveloppe commune, les lectures dont
 * le lien de réinitialisation restent ouvertes, et les cas d'usage de
 * l'application (connexion, invitation) passent par `auth.api`. Un seul
 * limiteur de gestes de membre s'applique à la porte.
 */
vi.mock('$app/env', () => ({ building: false, browser: false }));

vi.mock('$app/server', () => ({
	getRequestEvent: () => undefined
}));

vi.mock('#lib/server/startup.ts', () => ({
	startup: async () => undefined
}));

vi.mock('#lib/shared/logging/logger.ts', () => {
	const noop = () => undefined;
	return { logger: { debug: noop, info: noop, warn: noop, error: noop } };
});

vi.mock('#lib/server/db/index.ts', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const schema = await import('#lib/server/db/schema.ts');
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: 'drizzle' });
	return { db, sqlite };
});

const { sqlite } = await import('#lib/server/db/index.ts');
const { handle } = await import('../../../hooks.server.ts');
const { auth } = await import('../auth.ts');
const { betterAuthIdentity } = await import('./identity.ts');
const { provideIdentity } = await import('#lib/domain/auth/identity.ts');
const { adminUpdatePlayer } = await import('#lib/domain/players/service.ts');
const { resetThrottle } = await import('#lib/server/security/throttle.ts');
const { actions: loginActions } = await import('../../../routes/connexion/+page.server.ts');
const { POST: signOutRoute } = await import('../../../routes/deconnexion/+server.ts');

const ORIGIN = 'http://localhost:5173';
const PASSWORD = 'MotDePasse2026!';
const FORBIDDEN = { ok: false, key: 'error.forbidden', message: 'Accès refusé.' };
const RATE_LIMITED = {
	ok: false,
	key: 'error.rateLimited',
	message: 'Trop de tentatives. Réessaie dans un instant.'
};

let adminId = '';
let rootId = '';
let adminEmail = '';
let run = 0;

function adminActor(): Actor {
	return {
		kind: 'user',
		userId: rootId,
		name: 'Racine',
		role: 'admin',
		active: true
	};
}

type TestLocals = {
	requestId: string;
	actor: unknown;
	sessionId: string | null;
};

type TestEvent = {
	locals: TestLocals;
	url: URL;
	request: Request;
	isDataRequest: boolean;
	cookies: { set: () => void; get: () => undefined; delete: () => void };
};

function eventFor(path: string, init: RequestInit = {}): TestEvent {
	return {
		locals: { requestId: '', actor: null, sessionId: null },
		url: new URL(`${ORIGIN}${path}`),
		request: new Request(`${ORIGIN}${path}`, {
			...init,
			headers: {
				origin: ORIGIN,
				...(init.headers as Record<string, string> | undefined)
			}
		}),
		isDataRequest: false,
		cookies: { set: () => undefined, get: () => undefined, delete: () => undefined }
	};
}

async function request(
	path: string,
	init: RequestInit = {}
): Promise<{ status: number; body: string; cookie: string }> {
	const response = await handle({
		event: eventFor(path, init) as never,
		resolve: (async () => new Response('app')) as never
	} as never);
	const cookie = response.headers
		.getSetCookie()
		.map((value) => value.split(';')[0])
		.join('; ');
	return { status: response.status, body: await response.text(), cookie };
}

function post(path: string, cookie = '', body: unknown = {}): Promise<{
	status: number;
	body: string;
	cookie: string;
}> {
	return request(path, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...(cookie ? { cookie } : {})
		},
		body: JSON.stringify(body)
	});
}

async function programmaticSignIn(password = PASSWORD) {
	return auth.api.signInEmail({
		body: { email: adminEmail, password },
		asResponse: true
	});
}

function sessionCount(userId: string): number {
	const row = sqlite
		.prepare('select count(*) as count from session where user_id = ?')
		.get(userId) as { count: number };
	return row.count;
}

function jobCount(eventKey: string): number {
	const row = sqlite
		.prepare(
			'select count(*) as count from notification_jobs where event_key = ?'
		)
		.get(eventKey) as { count: number };
	return row.count;
}

function userRow() {
	return sqlite
		.prepare('select name, email, role, banned from user where id = ?')
		.get(adminId) as { name: string; email: string; role: string; banned: number };
}

/** Les mutations brutes : aucune ne doit atteindre Better Auth. */
const RAW_MUTATIONS: readonly {
	method: string;
	path: string;
	body?: unknown;
}[] = [
	{ method: 'GET', path: '/api/auth/admin/list-users' },
	{ method: 'GET', path: '/api/auth/admin/get-user?userId=someone' },
	{
		method: 'POST',
		path: '/api/auth/sign-in/email',
		body: { email: 'probe@example.test', password: PASSWORD }
	},
	{
		method: 'POST',
		path: '/api/auth/admin/set-role',
		body: { userId: 'someone', role: 'admin' }
	},
	{
		method: 'POST',
		path: '/api/auth/admin/create-user',
		body: { email: 'raw@example.test', password: PASSWORD, name: 'Brut' }
	},
	{
		method: 'POST',
		path: '/api/auth/admin/ban-user',
		body: { userId: 'someone' }
	},
	{
		method: 'POST',
		path: '/api/auth/admin/remove-user',
		body: { userId: 'someone' }
	},
	{
		method: 'POST',
		path: '/api/auth/admin/set-user-password',
		body: { userId: 'someone', newPassword: PASSWORD }
	},
	{
		method: 'POST',
		path: '/api/auth/update-user',
		body: { name: 'Pirate' }
	},
	{
		method: 'POST',
		path: '/api/auth/change-password',
		body: { currentPassword: PASSWORD, newPassword: 'AutreMotDePasse2026!' }
	},
	{
		method: 'POST',
		path: '/api/auth/request-password-reset',
		body: { email: 'probe@example.test' }
	},
	{
		method: 'POST',
		path: '/api/auth/reset-password',
		body: { newPassword: PASSWORD, token: 'jeton' }
	},
	{
		method: 'POST',
		path: '/api/auth/sign-out',
		body: {}
	},
	{ method: 'DELETE', path: '/api/auth/delete-user', body: {} }
];

/** Les écritures de membre couvertes par le seau du hook. */
const MEMBER_WRITES = [
	'/',
	'/discussion?/send',
	'/discussion?/poll',
	'/discussion?/vote',
	'/api/push/abonnement',
	'/profil?/notifications',
	'/matchs/game?/availability',
	'/remplacants?/claim',
	'/admin/parametres?/settings'
] as const;

beforeEach(async () => {
	provideIdentity(betterAuthIdentity);
	resetThrottle();
	sqlite.prepare('delete from notification_jobs').run();
	sqlite.prepare('delete from session').run();
	sqlite.prepare('delete from account').run();
	sqlite.prepare('delete from players').run();
	sqlite.prepare('delete from user').run();

	adminEmail = `admin${run++}@example.test`;
	const created = await auth.api.createUser({
		body: {
			email: adminEmail,
			password: PASSWORD,
			name: 'Admin Test',
			role: 'admin'
		}
	});
	adminId = created.user.id;
	const root = await auth.api.createUser({
		body: {
			email: `root${run}@example.test`,
			password: PASSWORD,
			name: 'Racine',
			role: 'admin'
		}
	});
	rootId = root.user.id;
	const insert = sqlite.prepare(
		`insert into players
		 (user_id, first_name, last_name, position, age, is_substitute, active, created_at, updated_at)
		 values (?, ?, 'Test', 'forward', 30, 0, 1, 0, 0)`
	);
	insert.run(adminId, 'Admin');
	insert.run(rootId, 'Racine');
});

describe('plan HTTP d’authentification', () => {
	it('refuse chaque mutation brute avec l’enveloppe commune', async () => {
		const signed = await programmaticSignIn();
		const cookie = signed.headers
			.getSetCookie()
			.map((value) => value.split(';')[0])
			.join('; ');
		const sessionsBefore = sessionCount(adminId);

		for (const route of RAW_MUTATIONS) {
			const response = await request(route.path, {
				method: route.method,
				headers: {
					'content-type': 'application/json',
					...(cookie ? { cookie } : {})
				},
				...(route.method === 'POST' ? { body: JSON.stringify(route.body ?? {}) } : {})
			});
			expect(response.status, `${route.method} ${route.path}`).toBe(403);
			expect(JSON.parse(response.body), `${route.method} ${route.path}`).toEqual(
				FORBIDDEN
			);
		}

		expect(userRow()).toEqual({
			name: 'Admin Test',
			email: adminEmail,
			role: 'admin',
			banned: 0
		});
		expect(sessionCount(adminId)).toBe(sessionsBefore);
	});

	it('laisse le lien GET de réinitialisation ouvert', async () => {
		const response = await request(
			`/api/auth/reset-password/jeton-invalide?callbackURL=${encodeURIComponent(
				`${ORIGIN}/reinitialiser-mot-de-passe`
			)}`,
			{ method: 'GET' }
		);

		expect(response.status).not.toBe(403);
		expect(response.body).not.toContain('error.forbidden');
	});

	it('garde la connexion du formulaire et l’invitation programmatique', async () => {
		const form = new FormData();
		form.set('email', adminEmail);
		form.set('password', PASSWORD);

		await expect(
			loginActions.default({
				request: new Request(`${ORIGIN}/connexion`, { method: 'POST', body: form }),
				getClientAddress: () => '203.0.113.9'
			} as never)
		).rejects.toMatchObject({ status: 303, location: '/' });

		const invited = await auth.api.createUser({
			body: {
				email: `invite${run++}@example.test`,
				password: PASSWORD,
				name: 'Invité',
				role: 'player'
			}
		});
		expect(invited.user.email).toContain('invite');
	});

	it('ferme la session par le service d’authentification', async () => {
		const signed = await programmaticSignIn();
		const cookie = signed.headers
			.getSetCookie()
			.map((value) => value.split(';')[0])
			.join('; ');
		expect(sessionCount(adminId)).toBe(1);

		const result = await signOutRoute({
			request: new Request(`${ORIGIN}/deconnexion`, {
				method: 'POST',
				headers: { cookie }
			})
		} as never).catch((cause: unknown) => cause);

		expect(result).toMatchObject({ status: 303, location: '/connexion' });
		expect(sessionCount(adminId)).toBe(0);
	});

	it('ne prépare aucun lien de réinitialisation pour un compte inactif', async () => {
		const requestReset = () =>
			auth.api.requestPasswordReset({
				body: {
					email: adminEmail,
					redirectTo: `${ORIGIN}/reinitialiser-mot-de-passe`
				}
			});

		await adminUpdatePlayer(adminActor(), adminId, { active: false });
		await requestReset();
		expect(jobCount('password_reset')).toBe(0);

		await adminUpdatePlayer(adminActor(), adminId, { active: true });
		await requestReset();
		expect(jobCount('password_reset')).toBeGreaterThan(0);
	});

	it('ferme la connexion et les sessions d’un compte désactivé', async () => {
		const signed = await programmaticSignIn();
		expect(signed.status).toBe(200);
		expect(sessionCount(adminId)).toBe(1);

		await adminUpdatePlayer(adminActor(), adminId, { active: false });

		expect(sessionCount(adminId)).toBe(0);
		await expect(programmaticSignIn()).rejects.toBeTruthy();

		// Une fiche inactive refuse la connexion même si le bannissement
		// fournisseur a été effacé.
		sqlite
			.prepare('update user set banned = 0, ban_reason = null where id = ?')
			.run(adminId);
		await expect(programmaticSignIn()).rejects.toBeTruthy();

		await adminUpdatePlayer(adminActor(), adminId, { active: true });
		await expect(programmaticSignIn()).resolves.toBeTruthy();
	});
});

describe('limiteur des gestes de membre', () => {
	it('refuse la 41e écriture de chaque porte de membre', async () => {
		const signed = await programmaticSignIn();
		const cookie = signed.headers
			.getSetCookie()
			.map((value) => value.split(';')[0])
			.join('; ');

		for (const path of MEMBER_WRITES) {
			resetThrottle();
			for (let index = 0; index < 40; index += 1) {
				const accepted = await post(path, cookie, {});
				expect(accepted.status, `${path} action ${index + 1}`).toBe(200);
			}
			const refused = await post(path, cookie, {});
			expect(refused.status, `${path} action 41`).toBe(429);
			expect(JSON.parse(refused.body), `${path} action 41`).toEqual(RATE_LIMITED);
		}
	});

	it('épargne les lectures et le plan d’authentification', async () => {
		const signed = await programmaticSignIn();
		const cookie = signed.headers
			.getSetCookie()
			.map((value) => value.split(';')[0])
			.join('; ');

		resetThrottle();
		for (let index = 0; index < 50; index += 1) {
			expect((await request('/discussion', { method: 'GET' })).status).toBe(200);
		}
		expect((await request('/api/health', { method: 'GET' })).status).toBe(200);

		// La déconnexion reste joignable après une rafale.
		for (let index = 0; index < 50; index += 1) {
			expect((await post('/deconnexion', cookie)).status).toBe(200);
		}

		// Le plan d'authentification est refusé par sa propre porte, jamais
		// transformé en 429 par le limiteur de membre.
		for (let index = 0; index < 50; index += 1) {
			const response = await post('/api/auth/sign-in/email', cookie, {
				email: adminEmail,
				password: PASSWORD
			});
			expect(response.status).toBe(403);
		}
	});

	it('ne consomme pas le seau pour un visiteur anonyme', async () => {
		resetThrottle();
		for (let index = 0; index < 50; index += 1) {
			expect((await post('/discussion?/poll')).status).toBe(200);
		}
	});
});
