import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';

vi.mock('#lib/domain/settings/service.ts', () => ({
	getSettings: () => ({
		'finance.overdueGraceDays': 0,
		'finance.installment1Due': '2026-11-01',
		'finance.installment2Due': '2026-12-01',
		'notifications.emailEnabled': true,
		'notifications.pushEnabled': false
	})
}));

const audit = vi.hoisted(() => ({ fail: false }));

vi.mock('#lib/domain/audit/service.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#lib/domain/audit/service.ts')>();
	return {
		...actual,
		recordAudit: (...args: Parameters<typeof actual.recordAudit>) => {
			if (audit.fail) throw new Error('audit down');
			actual.recordAudit(...args);
		}
	};
});

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
const { notifyOverdueBalances, recordPayment } = await import('./service.ts');

const actor: Actor = {
	kind: 'user', active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

function captureError(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	throw new Error('expected an error');
}

function paymentCount(): number {
	const row = sqlite.prepare('select count(*) as count from payments').get() as {
		count: number;
	};
	return row.count;
}

beforeEach(() => {
	audit.fail = false;
	sqlite.prepare('delete from payments').run();
	sqlite.prepare('delete from payment_plans').run();
	sqlite.prepare('delete from players').run();
	sqlite.prepare('delete from user').run();
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('admin', 'Admin', 'admin@example.test', 1, 0, 0, 'admin')`
		)
		.run();
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('player', 'Joueur', 'player@example.test', 1, 0, 0, 'player')`
		)
		.run();
	sqlite
		.prepare(
			`insert into players (user_id, first_name, last_name, position, age, is_substitute, active, created_at, updated_at)
			 values ('player', 'Jean', 'Test', 'forward', 30, 0, 1, 0, 0)`
		)
		.run();
});

describe('recordPayment', () => {
	it('rejects a payment without a plan and writes nothing', () => {
		const error = captureError(() =>
			recordPayment(actor, 'player', {
				amountCents: 5_000,
				paidAt: '2026-11-16',
				method: 'etransfer',
				note: null
			})
		);

		expect(error).toMatchObject({ code: 'CONFLICT', key: 'balance.noPlan' });
		expect(paymentCount()).toBe(0);
	});

	it('rejects a payment on a zero plan and writes nothing', () => {
		sqlite
			.prepare(
				`insert into payment_plans (id, player_id, total_cents, first_cents, second_cents, created_at, updated_at)
				 values ('plan', 'player', 0, 0, 0, 0, 0)`
			)
			.run();

		const error = captureError(() =>
			recordPayment(actor, 'player', {
				amountCents: 5_000,
				paidAt: '2026-11-16',
				method: 'etransfer',
				note: null
			})
		);

		expect(error).toMatchObject({ code: 'CONFLICT', key: 'balance.noPlan' });
		expect(paymentCount()).toBe(0);
	});

	it('accepts a payment on an active plan', () => {
		sqlite
			.prepare(
				`insert into payment_plans (id, player_id, total_cents, first_cents, second_cents, created_at, updated_at)
				 values ('plan', 'player', 30000, 15000, 15000, 0, 0)`
			)
			.run();

		recordPayment(actor, 'player', {
			amountCents: 5_000,
			paidAt: '2026-11-16',
			method: 'etransfer',
			note: null
		});

		expect(paymentCount()).toBe(1);
	});
});

describe('atomicité de l’audit financier', () => {
	it('annule le paiement quand la trace d’audit échoue', () => {
		sqlite
			.prepare(
				`insert into payment_plans (id, player_id, total_cents, first_cents, second_cents, created_at, updated_at)
				 values ('plan', 'player', 30000, 15000, 15000, 0, 0)`
			)
			.run();
		audit.fail = true;

		expect(() =>
			recordPayment(actor, 'player', {
				amountCents: 5_000,
				paidAt: '2026-11-16',
				method: 'etransfer',
				note: null
			})
		).toThrow('audit down');
		expect(paymentCount()).toBe(0);

		audit.fail = false;
		recordPayment(actor, 'player', {
			amountCents: 5_000,
			paidAt: '2026-11-16',
			method: 'etransfer',
			note: null
		});
		expect(paymentCount()).toBe(1);
	});
});

describe('avis de retard', () => {
	function jobs(): { count: number } {
		return sqlite
			.prepare(
				"select count(*) as count from notification_jobs where event_key = 'balance_overdue'"
			)
			.get() as { count: number };
	}

	it('crée un travail par canal une seule fois, même sur deux balayages', () => {
		sqlite
			.prepare(
				`insert into payment_plans (id, player_id, total_cents, first_cents, second_cents, first_due_date, second_due_date, created_at, updated_at)
				 values ('plan', 'player', 30000, 15000, 15000, '2020-01-01', '2099-01-01', 0, 0)`
			)
			.run();

		expect(notifyOverdueBalances()).toBe(2);
		expect(notifyOverdueBalances()).toBe(0);
		expect(jobs().count).toBe(2);
	});

	it('ne signale pas un plan qui n’est pas encore dû', () => {
		sqlite
			.prepare(
				`insert into payment_plans (id, player_id, total_cents, first_cents, second_cents, first_due_date, second_due_date, created_at, updated_at)
				 values ('plan', 'player', 30000, 15000, 15000, '2099-01-01', '2099-02-01', 0, 0)`
			)
			.run();

		expect(notifyOverdueBalances()).toBe(0);
		expect(jobs().count).toBe(0);
	});
});
