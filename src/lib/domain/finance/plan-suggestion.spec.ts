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

const { sqlite } = await import('#lib/server/db/index.ts');
const { applyDefaultPlan, defaultPlanFor } = await import('./service.ts');
const { invalidateSettingsCache } = await import('#lib/domain/settings/service.ts');

const NOW = 1_700_000_000_000;
const admin: Actor = {
	kind: 'user',
	userId: 'admin',
	name: 'Admin',
	role: 'admin',
	active: true
};

function addPlayer(id: string, position: 'forward' | 'defense' | 'goalie'): void {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values (?, ?, ?, 1, ?, ?, 'player')`
		)
		.run(id, id, `${id}@example.test`, NOW, NOW);
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, jersey_number, created_at, updated_at)
			 values (?, ?, 'Test', ?, 30, ?, ?, ?)`
		)
		.run(id, id, position, position === 'goalie' ? 31 : 12, NOW, NOW);
}

function settings(values: Record<string, unknown>): void {
	sqlite.prepare('delete from league_settings').run();
	const insert = sqlite.prepare(
		'insert into league_settings (key, value_json, updated_at, updated_by) values (?, ?, ?, ?)'
	);
	for (const [key, value] of Object.entries(values)) {
		insert.run(key, JSON.stringify(value), NOW, 'admin');
	}
	invalidateSettingsCache();
}

beforeEach(() => {
	for (const table of [
		'payments',
		'payment_plans',
		'audit_log',
		'league_settings',
		'players',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('admin', 'Admin', 'admin@example.test', 1, ?, ?, 'admin')`
		)
		.run(NOW, NOW);
	invalidateSettingsCache();
});

describe('suggestion de plan par défaut', () => {
	const cases = [
		{ position: 'forward' as const, discount: 0, total: 24_000, percent: 50 },
		{ position: 'forward' as const, discount: 100, total: 24_000, percent: 50 },
		{ position: 'defense' as const, discount: 50, total: 24_000, percent: 50 },
		{ position: 'goalie' as const, discount: 0, total: 24_000, percent: 50 },
		{ position: 'goalie' as const, discount: 50, total: 24_000, percent: 40 },
		{ position: 'goalie' as const, discount: 75, total: 24_000, percent: 25 }
	];

	for (const entry of cases) {
		it(`donne le même plan au ${entry.position} avec ${entry.discount} % de remise`, () => {
			settings({
				'finance.totalCents': entry.total,
				'finance.goalieDiscountPercent': entry.discount,
				'finance.firstInstallmentPercent': entry.percent,
				'finance.installment1Due': '2026-09-15',
				'finance.installment2Due': '2026-11-01'
			});
			const suggestion = defaultPlanFor(entry.position);
			const playerId = `player-${entry.position}-${entry.discount}-${entry.percent}`;
			addPlayer(playerId, entry.position);

			const balance = applyDefaultPlan(admin, playerId);

			expect(balance).not.toBeNull();
			expect(balance?.totalCents).toBe(suggestion.totalCents);
			expect(balance?.installments[0].amountCents).toBe(suggestion.firstCents);
			expect(balance?.installments[1].amountCents).toBe(suggestion.secondCents);
		});
	}

	it('refuse d’écrire un plan à zéro quand la remise atteint 100 %', () => {
		settings({
			'finance.totalCents': 24_000,
			'finance.goalieDiscountPercent': 100,
			'finance.firstInstallmentPercent': 50,
			'finance.installment1Due': '2026-09-15',
			'finance.installment2Due': '2026-11-01'
		});
		addPlayer('goalie-free', 'goalie');

		expect(defaultPlanFor('goalie')).toEqual({
			totalCents: 0,
			firstCents: 0,
			secondCents: 0
		});
		expect(() => applyDefaultPlan(admin, 'goalie-free')).toThrowError(
			expect.objectContaining({ key: 'balance.feeNotSet' })
		);
	});
});
