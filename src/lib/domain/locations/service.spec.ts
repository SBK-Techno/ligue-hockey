import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

const h = vi.hoisted(() => ({
	now: 1_700_000_000_000,
	today: '2023-11-14',
	defaultLocation: ''
}));

vi.mock('#lib/shared/time/clock.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/shared/time/clock.ts')>();
	return {
		...actual,
		clock: { nowMs: () => h.now },
		todayInZone: () => h.today
	};
});

vi.mock('#lib/domain/settings/service.ts', () => ({
	getSettings: () => ({
		'roster.goaliesPerTeam': 0,
		'roster.forwardsPerTeam': 1,
		'roster.defensePerTeam': 0,
		'games.defaultLocation': h.defaultLocation
	}),
	renameDefaultLocation: (_actor: unknown, previous: string, next: string) => {
		if (h.defaultLocation === previous) h.defaultLocation = next;
	}
}));

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

const { sqlite } = await import('#lib/server/db/index.ts');
const { createGame, getGame, updateGame } = await import('#lib/domain/games/service.ts');
const {
	createLocation,
	deleteLocation,
	listLocationMetrics,
	listLocations,
	updateLocation
} = await import('./service.ts');

const actor: Actor = {
	kind: 'user',
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

let dateCounter = 0;

function captureError(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	throw new Error('expected an error');
}

function addLocation(name: string, extra: Partial<{ address: string; notes: string }> = {}) {
	return createLocation(actor, {
		name,
		address: extra.address ?? null,
		mapUrl: null,
		notes: extra.notes ?? null
	});
}

function addGame(locationId: string, gameDate?: string) {
	dateCounter += 1;
	return createGame(actor, {
		gameDate: gameDate ?? `2026-01-${String(dateCounter).padStart(2, '0')}`,
		startTime: '09:00',
		locationId,
		notes: null
	});
}

beforeEach(() => {
	sqlite.prepare('delete from games').run();
	sqlite.prepare('delete from locations').run();
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('admin', 'Admin', 'admin@example.test', 1, 0, 0, 'admin')
			 on conflict (id) do nothing`
		)
		.run();
	dateCounter = 0;
	h.defaultLocation = '';
});

describe('locations service', () => {
	it('crée, liste et lit un lieu', () => {
		const created = addLocation('Aréna du Coin', {
			address: '12 rue Principale, Québec',
			notes: 'Porte 3'
		});

		expect(created).toMatchObject({
			name: 'Aréna du Coin',
			address: '12 rue Principale, Québec',
			notes: 'Porte 3'
		});
		expect(listLocations(actor)).toEqual([created]);
	});

	it('refuse un nom déjà pris', () => {
		addLocation('Aréna du Coin');

		const error = captureError(() => addLocation('Aréna du Coin'));

		expect(error).toMatchObject({ code: 'CONFLICT', key: 'admin.locationExists' });
	});

	it('refuse un nom déjà pris lors d’une modification', () => {
		addLocation('Aréna du Coin');
		const second = addLocation('Centre sportif');

		const error = captureError(() =>
			updateLocation(actor, {
				id: second.id,
				name: 'Aréna du Coin',
				address: null,
				mapUrl: null,
				notes: null
			})
		);

		expect(error).toMatchObject({ code: 'CONFLICT', key: 'admin.locationExists' });
	});
});

describe('game location assignment', () => {
	it('rejette un identifiant de lieu inconnu à la création', () => {
		const error = captureError(() =>
			createGame(actor, {
				gameDate: '2026-01-04',
				startTime: '09:00',
				locationId: 'location_inconnu',
				notes: null
			})
		);

		expect(error).toMatchObject({ code: 'NOT_FOUND', key: 'admin.locationNotFound' });
		const row = sqlite.prepare('select count(*) as count from games').get() as {
			count: number;
		};
		expect(row.count).toBe(0);
	});

	it('écrit le lieu choisi et son libellé figé', () => {
		const location = addLocation('Aréna du Coin', {
			address: '12 rue Principale, Québec'
		});
		const game = addGame(location.id);
		const view = getGame(actor, game.id);

		expect(game).toMatchObject({ locationId: location.id, location: 'Aréna du Coin' });
		expect(view).toMatchObject({
			locationId: location.id,
			location: 'Aréna du Coin',
			locationAddress: '12 rue Principale, Québec'
		});
	});

	it('change le lieu et le libellé lors d’une modification', () => {
		const first = addLocation('Aréna du Coin');
		const second = addLocation('Centre sportif');
		const game = addGame(first.id);

		const updated = updateGame(actor, game.id, {
			gameDate: game.gameDate,
			startTime: game.startTime,
			locationId: second.id,
			notes: null
		});

		expect(updated).toMatchObject({
			locationId: second.id,
			location: 'Centre sportif'
		});
	});

	it('garde le libellé figé quand seule une note change', () => {
		const location = addLocation('Aréna du Coin');
		const game = addGame(location.id);

		updateLocation(actor, {
			id: location.id,
			name: 'Centre sportif',
			address: null,
			mapUrl: null,
			notes: null
		});

		const updated = updateGame(actor, game.id, {
			gameDate: game.gameDate,
			startTime: '10:30',
			locationId: location.id,
			notes: 'Apporter les chandails'
		});

		expect(updated).toMatchObject({
			locationId: location.id,
			location: 'Aréna du Coin'
		});
		expect(getGame(actor, game.id).notes).toBe('Apporter les chandails');
	});

	it('suit le nom du lieu par défaut quand il est renommé', () => {
		const location = addLocation('Aréna du Coin');
		h.defaultLocation = 'Aréna du Coin';

		updateLocation(actor, {
			id: location.id,
			name: 'Centre sportif',
			address: null,
			mapUrl: null,
			notes: null
		});

		expect(h.defaultLocation).toBe('Centre sportif');
	});

	it('vide le lieu par défaut quand ce lieu est supprimé', () => {
		const location = addLocation('Aréna du Coin');
		h.defaultLocation = 'Aréna du Coin';

		deleteLocation(actor, { id: location.id });

		expect(h.defaultLocation).toBe('');
	});

	it('un lieu renommé change le choix sans réécrire les matchs passés', () => {
		const location = addLocation('Aréna du Coin');
		const game = addGame(location.id);

		updateLocation(actor, {
			id: location.id,
			name: 'Centre sportif',
			address: null,
			mapUrl: null,
			notes: null
		});

		expect(listLocations(actor).map((entry) => entry.name)).toEqual(['Centre sportif']);
		expect(getGame(actor, game.id)).toMatchObject({
			locationId: location.id,
			location: 'Aréna du Coin'
		});
	});
});

describe('location deletion', () => {
	it('refuse un lieu encore utilisé par un match', () => {
		const location = addLocation('Aréna du Coin');
		addGame(location.id);

		const error = captureError(() => deleteLocation(actor, { id: location.id }));

		expect(error).toMatchObject({ code: 'CONFLICT', key: 'admin.locationInUse' });
		expect(listLocations(actor)).toHaveLength(1);
	});

	it('supprime un lieu sans match', () => {
		const location = addLocation('Aréna du Coin');

		deleteLocation(actor, { id: location.id });

		expect(listLocations(actor)).toEqual([]);
	});
});

describe('location metrics', () => {
	it('regroupe les matchs, les terminés et les dates par lieu', () => {
		const used = addLocation('Aréna du Coin');
		const upcoming = addLocation('Centre sportif');
		const empty = addLocation('Vieille patinoire');

		const completed = addGame(used.id, '2023-10-01');
		sqlite.prepare("update games set status = 'completed', completed_at = 1 where id = ?").run(completed.id);
		addGame(used.id, '2026-02-01');
		addGame(upcoming.id, '2026-03-01');

		const metrics = new Map(
			listLocationMetrics(actor).map((metric) => [metric.locationId, metric])
		);

		expect(metrics.get(used.id)).toEqual({
			locationId: used.id,
			gameCount: 2,
			completedCount: 1,
			nextGameDate: '2026-02-01',
			lastGameDate: '2023-10-01'
		});
		expect(metrics.get(upcoming.id)).toEqual({
			locationId: upcoming.id,
			gameCount: 1,
			completedCount: 0,
			nextGameDate: '2026-03-01',
			lastGameDate: null
		});
		expect(metrics.get(empty.id)).toEqual({
			locationId: empty.id,
			gameCount: 0,
			completedCount: 0,
			nextGameDate: null,
			lastGameDate: null
		});
	});
});
