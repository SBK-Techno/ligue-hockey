import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

vi.mock('#lib/server/db/index.ts', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite);
	migrate(db, { migrationsFolder: 'drizzle' });
	return { db, sqlite };
});

vi.mock('#lib/domain/games/upcoming.ts', () => ({
	regenerateUpcomingGeneratedGames: vi.fn()
}));

const h = vi.hoisted(() => ({ createdUserId: 'invited-user' }));

vi.mock('#lib/domain/auth/identity.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('#lib/domain/auth/identity.ts')>();
	return {
		...original,
		identity: () => ({
			createUser: vi.fn(async ({ email, name }: { email: string; name: string }) => {
				const { sqlite } = await import('#lib/server/db/index.ts');
				sqlite
					.prepare(
						`insert into user (id, name, email, email_verified, created_at, updated_at, role)
						 values (?, ?, ?, 1, 0, 0, 'player')`
					)
					.run(h.createdUserId, name, email);
				return { id: h.createdUserId };
			}),
			updateName: vi.fn(),
			deleteUser: vi.fn(),
			setRole: vi.fn(),
			requestPasswordReset: vi.fn()
		})
	};
});

const { sqlite } = await import('#lib/server/db/index.ts');
const { actions, load } = await import('./+page.server.ts');

const admin: Actor = { kind: 'user', userId: 'admin', name: 'Admin', role: 'admin' };
const manager: Actor = { kind: 'user', userId: 'manager', name: 'Gérant', role: 'manager' };
const player: Actor = { kind: 'user', userId: 'player', name: 'Joueur', role: 'player' };

type FormFields = Record<string, string>;

function actionEvent(actor: Actor, fields: FormFields) {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) body.set(key, value);
	return {
		locals: { actor },
		request: new Request('http://localhost/remplacants', {
			method: 'POST',
			body
		})
	} as never;
}

function insertUser(id: string, role: string, email: string) {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values (?, ?, ?, 1, 0, 0, ?)`
		)
		.run(id, id, email, role);
}

function insertPlayer(
	userId: string,
	options: { isSubstitute?: boolean; position?: string } = {}
) {
	sqlite
		.prepare(
			`insert into players (user_id, first_name, last_name, position, age, is_substitute, active, created_at, updated_at)
			 values (?, ?, ?, ?, 30, ?, 1, 0, 0)`
		)
		.run(userId, 'Prénom', 'Nom', options.position ?? 'forward', options.isSubstitute ? 1 : 0);
}

const inviteFields: FormFields = {
	firstName: 'Alex',
	lastName: 'Tremblay',
	email: 'alex@example.test',
	position: 'forward',
	age: '27',
	jerseyNumber: '19'
};

beforeEach(() => {
	for (const table of [
		'notification_jobs',
		'sub_requests',
		'sub_profiles',
		'game_player_ratings',
		'game_slots',
		'game_availability',
		'games',
		'locations',
		'players',
		'league_settings',
		'audit_log',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	insertUser('admin', 'admin', 'admin@example.test');
	insertUser('manager', 'manager', 'manager@example.test');
	insertUser('player', 'player', 'player@example.test');
	insertUser('substitute', 'player', 'substitute@example.test');
	insertPlayer('player');
	insertPlayer('substitute', { isSubstitute: true });

	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`
		)
		.run();
	for (const [id, date, status] of [
		['future', '2099-01-05', 'scheduled'],
		['past', '2020-01-05', 'scheduled'],
		['cancelled', '2099-02-02', 'cancelled']
	] as const) {
		sqlite
			.prepare(
				`insert into games (id, game_date, start_time, location_id, location, status, roster_template_json, generated_at, generation_json, created_at, updated_at)
				 values (?, ?, '19:00', 'arena', 'Aréna', ?, '{}', null, null, 0, 0)`
			)
			.run(id, date, status);
	}
});

describe('banque de remplaçants', () => {
	it.each([
		['un gérant', manager],
		['un joueur', player]
	])('refuse une invitation pour %s sans la capacité managePlayers', async (_, actor) => {
		const result = await actions.inviteSubstitute!(
			actionEvent(actor, { ...inviteFields, isSubstitute: 'false' })
		);

		expect(result).toMatchObject({
			status: 403,
			data: { ok: false, key: 'error.forbidden' }
		});
		expect(
			sqlite.prepare('select count(*) as count from user where email = ?').get(inviteFields.email)
		).toEqual({ count: 0 });
	});

	it('crée un remplaçant même si le formulaire envoie la case à faux', async () => {
		const result = await actions.inviteSubstitute!(
			actionEvent(admin, { ...inviteFields, isSubstitute: 'false' })
		);

		expect(result).toMatchObject({ ok: true });
		expect(
			sqlite
				.prepare(
					'select is_substitute as isSubstitute, jersey_number as jerseyNumber from players where user_id = ?'
				)
				.get(h.createdUserId)
		).toEqual({ isSubstitute: 1, jerseyNumber: 19 });
	});

	it('marque et retire un remplaçant de la banque', async () => {
		const favorite = await actions.favorite!(
			actionEvent(admin, { playerId: 'substitute', favorite: 'true' })
		);
		expect(favorite).toMatchObject({ ok: true });
		expect(
			sqlite
				.prepare('select favorite from sub_profiles where player_id = ?')
				.get('substitute')
		).toEqual({ favorite: 1 });

		const removed = await actions.removeSubstitute!(
			actionEvent(admin, { playerId: 'substitute' })
		);
		expect(removed).toMatchObject({ ok: true });
		expect(
			sqlite
				.prepare('select is_substitute as isSubstitute from players where user_id = ?')
				.get('substitute')
		).toEqual({ isSubstitute: 0 });
	});

	it('refuse les mutations de la banque à un gérant', async () => {
		const favorite = await actions.favorite!(
			actionEvent(manager, { playerId: 'substitute', favorite: 'true' })
		);
		const removed = await actions.removeSubstitute!(
			actionEvent(manager, { playerId: 'substitute' })
		);

		for (const result of [favorite, removed]) {
			expect(result).toMatchObject({
				status: 403,
				data: { ok: false, key: 'error.forbidden' }
			});
		}
		expect(
			sqlite
				.prepare('select favorite from sub_profiles where player_id = ?')
				.get('substitute')
		).toBeUndefined();
		expect(
			sqlite
				.prepare('select is_substitute as isSubstitute from players where user_id = ?')
				.get('substitute')
		).toEqual({ isSubstitute: 1 });
	});
});

describe('places à combler', () => {
	it('ouvre une demande manuelle pour le match et le poste choisis', async () => {
		const result = await actions.request!(
			actionEvent(manager, { gameId: 'future', position: 'defense' })
		);

		expect(result).toMatchObject({ ok: true });
		expect(
			sqlite
				.prepare(
					'select game_id as gameId, position, reason, status from sub_requests'
				)
				.get()
		).toEqual({ gameId: 'future', position: 'defense', reason: 'manual', status: 'open' });
	});

	it('refuse une demande à un joueur', async () => {
		const result = await actions.request!(
			actionEvent(player, { gameId: 'future', position: 'defense' })
		);

		expect(result).toMatchObject({
			status: 403,
			data: { ok: false, key: 'error.forbidden' }
		});
		expect(sqlite.prepare('select count(*) as count from sub_requests').get()).toEqual({
			count: 0
		});
	});

	it('annule une demande ouverte', async () => {
		await actions.request!(actionEvent(manager, { gameId: 'future', position: 'forward' }));
		const request = sqlite
			.prepare('select id from sub_requests limit 1')
			.get() as { id: string };

		const result = await actions.cancel!(
			actionEvent(manager, { gameId: 'future', requestId: request.id })
		);

		expect(result).toMatchObject({ ok: true });
		expect(
			sqlite.prepare('select status from sub_requests where id = ?').get(request.id)
		).toEqual({ status: 'cancelled' });
	});

	it('refuse une annulation à un joueur', async () => {
		await actions.request!(actionEvent(manager, { gameId: 'future', position: 'forward' }));
		const request = sqlite
			.prepare('select id from sub_requests limit 1')
			.get() as { id: string };

		const result = await actions.cancel!(
			actionEvent(player, { gameId: 'future', requestId: request.id })
		);

		expect(result).toMatchObject({
			status: 403,
			data: { ok: false, key: 'error.forbidden' }
		});
		expect(
			sqlite.prepare('select status from sub_requests where id = ?').get(request.id)
		).toEqual({ status: 'open' });
	});

	it('laisse un joueur annuler sa propre demande', async () => {
		sqlite
			.prepare(
				`insert into sub_requests (id, game_id, requested_by_player_id, created_by_user_id, position, reason, status, created_at, filled_by_player_id, filled_at, cancelled_at)
				 values ('own', 'future', 'player', null, 'forward', 'absence', 'open', 0, null, null, null)`
			)
			.run();

		const result = await actions.cancelOwn!(
			actionEvent(player, { gameId: 'future', requestId: 'own' })
		);

		expect(result).toMatchObject({ ok: true });
		expect(sqlite.prepare('select status from sub_requests where id = ?').get('own')).toEqual({
			status: 'cancelled'
		});
	});

	it('refuse la demande d’un autre joueur', async () => {
		sqlite
			.prepare(
				`insert into sub_requests (id, game_id, requested_by_player_id, created_by_user_id, position, reason, status, created_at, filled_by_player_id, filled_at, cancelled_at)
				 values ('foreign', 'future', 'substitute', null, 'forward', 'absence', 'open', 0, null, null, null)`
			)
			.run();

		const result = await actions.cancelOwn!(
			actionEvent(player, { gameId: 'future', requestId: 'foreign' })
		);

		expect(result).toMatchObject({
			status: 403,
			data: { ok: false, key: 'subs.notRequester' }
		});
		expect(
			sqlite.prepare('select status from sub_requests where id = ?').get('foreign')
		).toEqual({ status: 'open' });
	});
});

describe('chargement de la page', () => {
	type LoadResult = {
		games: { id: string }[];
		canManageRequests: boolean;
		canManagePool: boolean;
	};

	it('donne la liste des matchs à venir seulement aux gestionnaires', async () => {
		const managerData = (await load({ locals: { actor: manager } } as never)) as LoadResult;
		expect(managerData.games.map((game) => game.id)).toEqual(['future']);
		expect(managerData.canManageRequests).toBe(true);
		expect(managerData.canManagePool).toBe(false);

		const adminData = (await load({ locals: { actor: admin } } as never)) as LoadResult;
		expect(adminData.games.map((game) => game.id)).toEqual(['future']);
		expect(adminData.canManageRequests).toBe(true);
		expect(adminData.canManagePool).toBe(true);

		const playerData = (await load({ locals: { actor: player } } as never)) as LoadResult;
		expect(playerData.games).toEqual([]);
		expect(playerData.canManageRequests).toBe(false);
		expect(playerData.canManagePool).toBe(false);
	});
});
