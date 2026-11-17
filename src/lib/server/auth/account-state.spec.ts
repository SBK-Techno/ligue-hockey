import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

/**
 * Le plan d'administration de Better Auth vit sous `/api/auth`, hors des
 * gardes de page. Ce spec traverse le vrai `handle` : session réelle, plugin
 * admin réel, base migrée, et la porte ajoutée aux routes `/api/auth/admin/*`.
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

const ORIGIN = 'http://localhost:5173';
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

function signIn(password: string): Promise<{ status: number; body: string; cookie: string }> {
	return request('/api/auth/sign-in/email', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: adminEmail, password })
	});
}

/** Les quinze routes du plan d'administration, avec leur méthode. */
const ADMIN_ROUTES: readonly [method: 'GET' | 'POST', path: string][] = [
	['POST', '/api/auth/admin/set-role'],
	['GET', '/api/auth/admin/get-user?id=someone'],
	['POST', '/api/auth/admin/create-user'],
	['POST', '/api/auth/admin/update-user'],
	['GET', '/api/auth/admin/list-users'],
	['POST', '/api/auth/admin/list-user-sessions'],
	['POST', '/api/auth/admin/unban-user'],
	['POST', '/api/auth/admin/ban-user'],
	['POST', '/api/auth/admin/impersonate-user'],
	['POST', '/api/auth/admin/stop-impersonating'],
	['POST', '/api/auth/admin/revoke-user-session'],
	['POST', '/api/auth/admin/revoke-user-sessions'],
	['POST', '/api/auth/admin/remove-user'],
	['POST', '/api/auth/admin/set-user-password'],
	['POST', '/api/auth/admin/has-permission']
];

async function adminRouteStatus(cookie: string) {
	return Promise.all(
		ADMIN_ROUTES.map(async ([method, path]) => {
			const header: Record<string, string> = cookie ? { cookie } : {};
			if (method === 'POST') header['content-type'] = 'application/json';
			const response = await request(path, {
				method,
				headers: header,
				...(method === 'POST' ? { body: '{}' } : {})
			});
			return { path, status: response.status };
		})
	);
}

beforeEach(async () => {
	provideIdentity(betterAuthIdentity);
	sqlite.prepare('delete from session').run();
	sqlite.prepare('delete from account').run();
	sqlite.prepare('delete from players').run();
	sqlite.prepare('delete from user').run();

	adminEmail = `admin${run++}@example.test`;
	const created = await auth.api.createUser({
		body: {
			email: adminEmail,
			password: 'MotDePasse2026!',
			name: 'Admin Test',
			role: 'admin'
		}
	});
	adminId = created.user.id;
	const root = await auth.api.createUser({
		body: {
			email: 'root@example.test',
			password: 'MotDePasse2026!',
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

describe('état du compte et plan d’administration', () => {
	it('retire la connexion et tout le plan admin à un compte désactivé', async () => {
		const signed = await signIn('MotDePasse2026!');
		expect(signed.status).toBe(200);
		expect(signed.cookie).toContain('session_token');

		const before = await adminRouteStatus(signed.cookie);
		for (const route of before) {
			expect(route.status, `${route.path} avant désactivation`).not.toBe(401);
			expect(route.status, `${route.path} avant désactivation`).not.toBe(403);
		}

		await adminUpdatePlayer(adminActor(), adminId, { active: false });

		const banned = sqlite
			.prepare('select banned, ban_reason from user where id = ?')
			.get(adminId) as { banned: number; ban_reason: string | null };
		expect(banned.banned).toBe(1);

		const again = await signIn('MotDePasse2026!');
		expect([400, 401, 403]).toContain(again.status);
		expect(again.cookie).not.toContain('session_token');

		const sessions = sqlite
			.prepare('select count(*) as count from session where user_id = ?')
			.get(adminId) as { count: number };
		expect(sessions.count).toBe(0);

		const after = await adminRouteStatus(signed.cookie);
		for (const route of after) {
			expect(route.status, route.path).toBeGreaterThanOrEqual(401);
			expect(route.status, route.path).toBeLessThanOrEqual(403);
		}

		await adminUpdatePlayer(adminActor(), adminId, { active: true });
		const reactivated = await signIn('MotDePasse2026!');
		expect(reactivated.status).toBe(200);
		const reopened = await request('/api/auth/admin/list-users', {
			headers: { cookie: reactivated.cookie }
		});
		expect(reopened.status).toBe(200);
	});

	it('refuse une fiche inactive même si son bannissement a été effacé', async () => {
		const signed = await signIn('MotDePasse2026!');
		expect(signed.status).toBe(200);

		await adminUpdatePlayer(adminActor(), adminId, { active: false });
		// Une fiche désactivée avant la livraison du bannissement n'a pas de
		// drapeau : le refus doit venir de la fiche, pas seulement du drapeau.
		sqlite
			.prepare('update user set banned = 0, ban_reason = null where id = ?')
			.run(adminId);

		const again = await signIn('MotDePasse2026!');
		expect([400, 401, 403]).toContain(again.status);
		expect(again.cookie).not.toContain('session_token');
	});
});
