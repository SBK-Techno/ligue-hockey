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
const { actions, load } = await import('./+page.server.ts');

const admin: Actor = { kind: 'user', userId: 'admin', name: 'Admin', role: 'admin' };
const player: Actor = { kind: 'user', userId: 'player', name: 'Joueur', role: 'player' };
const substitute: Actor = {
	kind: 'user',
	userId: 'substitute',
	name: 'Remplaçant',
	role: 'player'
};

function insertUser(id: string, role: string) {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values (?, ?, ?, 1, 0, 0, ?)`
		)
		.run(id, id, `${id}@example.test`, role);
}

function insertPlayer(
	userId: string,
	options: { isSubstitute?: boolean; position?: string; jersey?: number } = {}
) {
	sqlite
		.prepare(
			`insert into players (user_id, first_name, last_name, position, age, jersey_number, is_substitute, active, created_at, updated_at)
			 values (?, ?, ?, ?, 30, ?, ?, 1, 0, 0)`
		)
		.run(
			userId,
			'Prénom',
			userId,
			options.position ?? 'forward',
			options.jersey ?? null,
			options.isSubstitute ? 1 : 0
		);
}

function loadFor(actor: Actor, isSubstitute = false) {
	return load({
		locals: { actor },
		parent: async () => ({ hasPlayerProfile: true, isSubstitute })
	} as never);
}

function actionEvent(actor: Actor, fields: Record<string, string>) {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) body.set(key, value);
	return {
		locals: { actor },
		request: new Request('http://localhost/', { method: 'POST', body })
	} as never;
}

beforeEach(() => {
	for (const table of [
		'poll_votes',
		'poll_options',
		'polls',
		'chat_messages',
		'notification_jobs',
		'sub_requests',
		'sub_profiles',
		'game_player_ratings',
		'game_slots',
		'game_availability',
		'games',
		'payments',
		'payment_plans',
		'locations',
		'players',
		'league_settings',
		'audit_log',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}

	insertUser('admin', 'admin');
	insertUser('player', 'player');
	insertUser('other', 'player');
	insertUser('other2', 'player');
	insertUser('substitute', 'player');
	insertPlayer('admin', { jersey: 1 });
	insertPlayer('player', { jersey: 9 });
	insertPlayer('other', { jersey: 10 });
	insertPlayer('other2', { jersey: 11 });
	insertPlayer('substitute', { isSubstitute: true, jersey: 31 });

	sqlite
		.prepare(
			`insert into locations (id, name, created_at, updated_at) values ('arena', 'Aréna', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into games (id, game_date, start_time, location_id, location, status, roster_template_json, generated_at, generation_json, created_at, updated_at)
			 values ('future', '2099-01-05', '09:00', 'arena', 'Aréna', 'scheduled', '{}', null, null, 0, 0)`
		)
		.run();
	for (const [id, playerId, slotIndex, position] of [
		['slot-1', 'player', 0, 'forward'],
		['slot-2', null, 1, 'forward']
	] as const) {
		sqlite
			.prepare(
				`insert into game_slots (id, game_id, team, position, slot_index, assigned_player_id, assignment_kind, created_at, updated_at)
				 values (?, 'future', 'black', ?, ?, ?, ?, 0, 0)`
			)
			.run(id, position, slotIndex, playerId, playerId ? 'regular' : null);
	}
	sqlite
		.prepare(
			`insert into game_availability (game_id, player_id, status, updated_at) values ('future', 'player', 'present', 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into game_availability (game_id, player_id, status, updated_at) values ('future', 'other', 'absent', 0)`
		)
		.run();

	sqlite
		.prepare(
			`insert into payment_plans (id, player_id, total_cents, first_cents, second_cents, first_due_date, second_due_date, created_at, updated_at)
			 values ('plan-player', 'player', 10000, 5000, 5000, '2020-01-01', '2020-02-01', 0, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into payment_plans (id, player_id, total_cents, first_cents, second_cents, first_due_date, second_due_date, created_at, updated_at)
			 values ('plan-other', 'other', 90000, 45000, 45000, '2020-01-01', '2020-02-01', 0, 0)`
		)
		.run();

	sqlite
		.prepare(
			`insert into chat_messages (id, author_user_id, kind, body, created_at) values ('poll-msg', 'admin', 'poll', null, 0)`
		)
		.run();
	sqlite
		.prepare(
			`insert into polls (message_id, question, closes_at, created_at) values ('poll-msg', 'On joue ?', null, 0)`
		)
		.run();
	for (const [id, label, index] of [
		['opt-yes', 'Oui', 0],
		['opt-no', 'Non', 1]
	] as const) {
		sqlite
			.prepare(
				`insert into poll_options (id, message_id, label, option_index) values (?, 'poll-msg', ?, ?)`
			)
			.run(id, label, index);
	}

	sqlite
		.prepare(
			`insert into sub_requests (id, game_id, requested_by_player_id, created_by_user_id, position, reason, status, created_at, filled_by_player_id, filled_at, cancelled_at)
			 values ('req-forward', 'future', 'other', null, 'forward', 'absence', 'open', 0, null, null, null)`
		)
		.run();
	sqlite
		.prepare(
			`insert into sub_requests (id, game_id, requested_by_player_id, created_by_user_id, position, reason, status, created_at, filled_by_player_id, filled_at, cancelled_at)
			 values ('req-defense', 'future', 'other2', null, 'defense', 'absence', 'open', 0, null, null, null)`
		)
		.run();
	sqlite
		.prepare(
			`insert into sub_profiles (player_id, favorite, positions_json, created_at, updated_at)
			 values ('substitute', 0, '["forward"]', 0, 0)`
		)
		.run();
});

describe('chargement de l’accueil', () => {
	it('ne donne aucune donnée de gestion, d’évaluation ou de solde étranger à un joueur', async () => {
		const data = (await loadFor(player)) as {
			board: { manager: boolean; panels: { kind: string }[] };
			managerSummary: unknown;
			evaluationGame: unknown;
			balance: { playerId: string; totalCents: number };
			claimable: unknown[];
			openPoll: { unvoted: boolean } | null;
		};

		expect(data.board.manager).toBe(false);
		expect(data.board.panels.some((panel) => panel.kind === 'manager')).toBe(false);
		expect(data.managerSummary).toBeNull();
		expect(data.evaluationGame).toBeNull();
		expect(data.balance).toMatchObject({ playerId: 'player', totalCents: 10000 });
		expect(data.claimable).toEqual([]);
		expect(data.openPoll?.unvoted).toBe(true);
		expect(data).not.toHaveProperty('ratings');
		expect(data).not.toHaveProperty('balances');
	});

	it('donne le bandeau de gestion et les compteurs au gestionnaire', async () => {
		const data = (await loadFor(admin)) as {
			board: { manager: boolean };
			managerSummary: {
				openSlots: number;
				present: number;
				absent: number;
				unknown: number;
				generated: boolean;
			};
		};

		expect(data.board.manager).toBe(true);
		expect(data.managerSummary).toMatchObject({
			openSlots: 1,
			present: 1,
			absent: 1,
			unknown: 2,
			generated: false
		});
	});

	it('donne les places ouvertes au remplaçant seulement', async () => {
		const data = (await loadFor(substitute, true)) as {
			claimable: { id: string }[];
			board: { actions: { kind: string }[] };
		};

		expect(data.claimable.map((request) => request.id)).toEqual(['req-forward']);
		expect(data.board.actions.map((action) => action.kind)).toContain('claim');
	});
});

describe('actions de l’accueil', () => {
	it('enregistre un vote de sondage', async () => {
		const result = await actions.vote!(
			actionEvent(player, { messageId: 'poll-msg', optionId: 'opt-yes' })
		);

		expect(result).toMatchObject({ ok: true });
		expect(
			sqlite
				.prepare('select option_id as optionId from poll_votes where message_id = ? and user_id = ?')
				.get('poll-msg', 'player')
		).toEqual({ optionId: 'opt-yes' });
	});

	it('réserve une place à un remplaçant admissible', async () => {
		const result = await actions.claim!(
			actionEvent(substitute, { gameId: 'future', requestId: 'req-forward' })
		);

		expect(result).toMatchObject({ ok: true });
		expect(
			sqlite
				.prepare(
					'select status, filled_by_player_id as filledBy from sub_requests where id = ?'
				)
				.get('req-forward')
		).toEqual({ status: 'filled', filledBy: 'substitute' });
	});

	it('refuse une place à un joueur régulier', async () => {
		const result = await actions.claim!(
			actionEvent(player, { gameId: 'future', requestId: 'req-defense' })
		);

		expect(result).toMatchObject({
			status: 403,
			data: { ok: false, key: 'subs.notEligible' }
		});
		expect(
			sqlite.prepare('select status from sub_requests where id = ?').get('req-defense')
		).toEqual({ status: 'open' });
	});
});
