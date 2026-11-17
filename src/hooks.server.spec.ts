import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branding } from '#lib/generated/branding.ts';

const h = vi.hoisted(() => ({
	getSession: vi.fn(),
	isAccountActive: vi.fn(),
	resolve: vi.fn(),
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	}
}));

vi.mock('$app/env', () => ({ building: false }));

vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: async ({
		event,
		resolve
	}: {
		event: unknown;
		resolve: (event: unknown) => Promise<Response>;
	}) => resolve(event)
}));

vi.mock('#lib/server/auth.ts', () => ({
	auth: { api: { getSession: h.getSession } }
}));

vi.mock('#lib/server/startup.ts', () => ({
	startup: async () => undefined
}));

vi.mock('#lib/domain/players/account-status.ts', () => ({
	isAccountActive: h.isAccountActive
}));

vi.mock('#lib/shared/logging/logger.ts', () => ({
	logger: h.logger
}));

const { handle } = await import('./hooks.server.ts');
const { PUBLIC_ASSET_PATHS, actorContextRequired } = await import('#lib/server/actor-context.ts');
const { ROBOTS_PATH, SERVICE_WORKER_PATH } = await import('../scripts/lib/branding.ts');

type TestEvent = {
	locals: {
		requestId: string;
		actor: unknown;
		sessionId: string | null;
	};
	url: URL;
	request: Request;
	isDataRequest: boolean;
};

function eventFor(path: string, headers: Record<string, string> = {}): TestEvent {
	return {
		locals: { requestId: '', actor: null, sessionId: null },
		url: new URL(`https://ligue.test${path}`),
		request: new Request(`https://ligue.test${path}`, { headers }),
		isDataRequest: path.endsWith('/__data.json')
	};
}

async function request(event: TestEvent): Promise<Response> {
	h.resolve.mockResolvedValue(new Response('ok'));
	return handle({
		event: event as never,
		resolve: h.resolve as never
	} as never);
}

const session = {
	user: { id: 'manager', name: 'Gérante', role: 'manager' },
	session: { id: 'session-1' }
};

describe('résolution du contexte acteur', () => {
	beforeEach(() => {
		h.getSession.mockReset();
		h.isAccountActive.mockReset();
		h.resolve.mockReset();
	});

	it('résout la session sur une page HTML même avec Accept: */*', async () => {
		h.getSession.mockResolvedValue(session);
		h.isAccountActive.mockReturnValue(true);
		const event = eventFor('/matchs', { accept: '*/*' });

		const response = await request(event);

		expect(h.getSession).toHaveBeenCalledTimes(1);
		expect(h.isAccountActive).toHaveBeenCalledWith('manager');
		expect(event.locals.actor).toMatchObject({
			kind: 'user',
			userId: 'manager',
			role: 'manager',
			active: true
		});
		expect(response.headers.get('cache-control')).toBe('private, no-store');
	});

	it('rend une session de joueur désactivé anonyme dès la requête suivante', async () => {
		h.getSession.mockResolvedValue(session);
		h.isAccountActive.mockReturnValue(false);
		const event = eventFor('/admin', { accept: 'text/html' });

		await request(event);

		expect(event.locals.actor).toEqual({ kind: 'anonymous' });
	});

	it('ne lit ni session ni joueur pour un actif immuable', async () => {
		const event = eventFor('/_app/immutable/entry/start.js');

		await request(event);

		expect(h.getSession).not.toHaveBeenCalled();
		expect(h.isAccountActive).not.toHaveBeenCalled();
		expect(event.locals.actor).toEqual({ kind: 'anonymous' });
	});

	it('classe les fichiers publics chez le propriétaire du branding', () => {
		expect([...PUBLIC_ASSET_PATHS].sort()).toEqual([...branding.publicPaths].sort());
		expect(branding.publicPaths).toContain(ROBOTS_PATH);
		expect(branding.publicPaths).toContain(SERVICE_WORKER_PATH);
		for (const path of branding.publicPaths) {
			expect(actorContextRequired(path), path).toBe(false);
		}
	});

	it('demande un acteur pour une page, des données, une API ou une route inconnue', () => {
		for (const path of [
			'/matchs',
			'/matchs/__data.json',
			'/api/health',
			'/admin',
			'/route-inconnue'
		]) {
			expect(actorContextRequired(path), path).toBe(true);
		}
		expect(actorContextRequired('/_app/immutable/entry/start.js')).toBe(false);
	});
});
