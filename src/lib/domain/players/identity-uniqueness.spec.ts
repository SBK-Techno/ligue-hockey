import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_IDS } from '#config/avatars.ts';
import { identityAllowedForPosition } from '#config/identities.ts';
import { IDENTITY_IDS } from '#config/identities.ts';
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

const h = vi.hoisted(() => ({
	createUser: vi.fn(),
	deleteUser: vi.fn(),
	updateName: vi.fn(async () => undefined),
	requestPasswordReset: vi.fn(async () => undefined),
	regenerate: vi.fn()
}));

vi.mock('../auth/identity.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('../auth/identity.ts')>();
	return {
		...original,
		identity: () => ({
			createUser: h.createUser,
			deleteUser: h.deleteUser,
			updateName: h.updateName,
			setRole: vi.fn(),
			setAccountState: vi.fn(),
			revokeSessions: vi.fn(),
			requestPasswordReset: h.requestPasswordReset
		})
	};
});

vi.mock('#lib/domain/games/upcoming.ts', () => ({
	regenerateUpcomingGeneratedGames: h.regenerate
}));

const { sqlite } = await import('#lib/server/db/index.ts');
const {
	adminUpdatePlayer,
	getOwnAvatarPicker,
	getOwnProfile,
	invitePlayer,
	updateOwnProfile
} = await import('./service.ts');

const NOW = 1_700_000_000_000;

const admin: Actor = {
	kind: 'user',
	userId: 'admin',
	name: 'Admin',
	role: 'admin',
	active: true
};

const inviteInput = {
	firstName: 'Nouveau',
	lastName: 'Joueur',
	email: 'nouveau@example.test',
	position: 'forward' as const,
	age: 25,
	jerseyNumber: null,
	isSubstitute: false
};

function addUser(id: string, role: 'player' | 'admin' = 'player'): void {
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values (?, ?, ?, 1, ?, ?, ?)`
		)
		.run(id, id, `${id}@example.test`, NOW, NOW, role);
}

function addPlayer(
	id: string,
	options: {
		position?: 'forward' | 'defense' | 'goalie';
		avatarId?: string | null;
		active?: boolean;
		role?: 'player' | 'admin';
	} = {}
): void {
	addUser(id, options.role ?? 'player');
	sqlite
		.prepare(
			`insert into players
			 (user_id, first_name, last_name, position, age, avatar_id, active, created_at, updated_at)
			 values (?, ?, 'Test', ?, 30, ?, ?, ?, ?)`
		)
		.run(
			id,
			id,
			options.position ?? 'forward',
			options.avatarId ?? null,
			options.active === false ? 0 : 1,
			NOW,
			NOW
		);
}

function playerRow(id: string): { avatar_id: string | null; active: number; position: string } {
	return sqlite
		.prepare('select avatar_id, active, position from players where user_id = ?')
		.get(id) as { avatar_id: string | null; active: number; position: string };
}

beforeEach(() => {
	for (const table of [
		'game_player_ratings',
		'game_goals',
		'game_penalties',
		'game_availability',
		'sub_requests',
		'game_slots',
		'games',
		'locations',
		'players',
		'audit_log',
		'user'
	]) {
		sqlite.prepare(`delete from ${table}`).run();
	}
	addUser('admin', 'admin');
	h.createUser.mockReset();
	h.createUser.mockImplementation(async ({ email, name }: { email: string; name: string }) => {
		const id = 'new-player';
		sqlite
			.prepare(
				`insert into user (id, name, email, email_verified, created_at, updated_at, role)
				 values (?, ?, ?, 1, ?, ?, 'player')`
			)
			.run(id, name, email, NOW, NOW);
		return { id };
	});
	h.deleteUser.mockReset();
	h.deleteUser.mockImplementation(async (id: string) => {
		sqlite.prepare('delete from user where id = ?').run(id);
	});
	h.regenerate.mockClear();
});

describe('unicité des identités actives', () => {
	it('garde 58 identités actives distinctes et non nulles', () => {
		for (const [index, avatarId] of IDENTITY_IDS.entries()) {
			addPlayer(`player-${index}`, { avatarId });
		}

		const rows = sqlite
			.prepare('select avatar_id, active from players where active = 1')
			.all() as { avatar_id: string | null; active: number }[];
		expect(rows).toHaveLength(58);
		expect(rows.every((row) => row.avatar_id !== null)).toBe(true);
		expect(new Set(rows.map((row) => row.avatar_id)).size).toBe(58);
	});

	it('refuse le 59e joueur avec un message explicite et sans écrire de null', async () => {
		for (const [index, avatarId] of IDENTITY_IDS.entries()) {
			addPlayer(`player-${index}`, { avatarId });
		}

		await expect(invitePlayer(admin, inviteInput)).rejects.toMatchObject({
			key: 'error.noIdentityAvailable'
		});
		expect(h.createUser).not.toHaveBeenCalled();
		const rows = sqlite
			.prepare('select avatar_id from players where active = 1')
			.all() as { avatar_id: string | null }[];
		expect(rows).toHaveLength(58);
		expect(rows.every((row) => row.avatar_id !== null)).toBe(true);
	});

	it('donne la dernière identité libre au 58e joueur', async () => {
		for (const [index, avatarId] of IDENTITY_IDS.slice(0, 57).entries()) {
			addPlayer(`player-${index}`, { avatarId });
		}

		await invitePlayer(admin, inviteInput);

		expect(playerRow('new-player').avatar_id).toBe(IDENTITY_IDS[57]);
	});

	it('nettoie le compte créé si la réservation échoue après la création', async () => {
		for (const [index, avatarId] of IDENTITY_IDS.slice(0, 57).entries()) {
			addPlayer(`player-${index}`, { avatarId });
		}
		h.createUser.mockImplementation(async ({ email, name }: { email: string; name: string }) => {
			const id = 'new-player';
			sqlite
				.prepare(
					`insert into user (id, name, email, email_verified, created_at, updated_at, role)
					 values (?, ?, ?, 1, ?, ?, 'player')`
				)
				.run(id, name, email, NOW, NOW);
			addPlayer('race-winner', { avatarId: IDENTITY_IDS[57] });
			return { id };
		});

		await expect(invitePlayer(admin, inviteInput)).rejects.toMatchObject({
			key: 'error.noIdentityAvailable'
		});
		expect(h.deleteUser).toHaveBeenCalledWith('new-player');
		expect(
			sqlite.prepare("select count(*) as count from players where user_id = 'new-player'").get()
		).toEqual({ count: 0 });
	});

	it('refuse de réactiver un joueur dont l’identité a été prise', async () => {
		addPlayer('inactive', { avatarId: 'capitaine-navy', active: false });
		addPlayer('active', { avatarId: 'capitaine-navy' });

		await expect(
			adminUpdatePlayer(admin, 'inactive', { active: true })
		).rejects.toMatchObject({ key: 'error.avatarTaken' });
		expect(playerRow('inactive').active).toBe(0);
	});

	it('remplace une identité retirée du catalogue à la réactivation', async () => {
		addPlayer('inactive', { avatarId: 'visage-retire', active: false });

		await adminUpdatePlayer(admin, 'inactive', { active: true });

		const avatarId = playerRow('inactive').avatar_id;
		expect(avatarId).not.toBe('visage-retire');
		expect(IDENTITY_IDS).toContain(avatarId);
	});

	it('ne laisse qu’un gagnant à deux réservations concurrentes', async () => {
		addPlayer('first', { avatarId: 'capitaine-navy' });
		addPlayer('second', { avatarId: 'barbe-de-brique' });

		const results = await Promise.allSettled([
			adminUpdatePlayer(admin, 'first', { avatarId: 'tuque-rouge' }),
			adminUpdatePlayer(admin, 'second', { avatarId: 'tuque-rouge' })
		]);

		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
		const winner = sqlite
			.prepare("select count(*) as count from players where active = 1 and avatar_id = 'tuque-rouge'")
			.get() as { count: number };
		expect(winner.count).toBe(1);
	});

	it('ne marque dans le sélecteur que les identités réellement prises', () => {
		addPlayer('me', { avatarId: 'capitaine-navy' });
		addPlayer('other', { avatarId: 'tuque-rouge' });

		const picker = getOwnAvatarPicker({
			kind: 'user',
			userId: 'me',
			name: 'Moi',
			role: 'player',
			active: true
		});

		expect(picker.selected).toBe('capitaine-navy');
		expect(picker.taken).toContain('tuque-rouge');
		expect(picker.taken).not.toContain('capitaine-navy');
		expect(picker.taken).not.toContain('barbe-de-brique');
	});

	it('refuse un doublon actif au niveau de la base', () => {
		addPlayer('first', { avatarId: 'capitaine-navy' });
		addPlayer('second', { avatarId: 'barbe-de-brique' });

		expect(() =>
			sqlite
				.prepare("update players set avatar_id = 'capitaine-navy' where user_id = 'second'")
				.run()
		).toThrow(/UNIQUE constraint failed/);
	});
});

describe('poste et identité', () => {
	it('attribue une légende du poste après les 28 visages', async () => {
		for (const [index, avatarId] of AVATAR_IDS.entries()) {
			addPlayer(`face-${index}`, { avatarId });
		}

		await invitePlayer(admin, inviteInput);

		const avatarId = playerRow('new-player').avatar_id;
		expect(avatarId).toBe('legende-maurice-richard');
		expect(identityAllowedForPosition(avatarId as never, 'forward')).toBe(true);
	});

	it('refuse Lafleur à un gardien par la fiche personnelle', async () => {
		addPlayer('goalie', { position: 'goalie', avatarId: 'masque-debutant' });

		await expect(
			updateOwnProfile(
				{
					kind: 'user',
					userId: 'goalie',
					name: 'Gardien',
					role: 'player',
					active: true
				},
				{
					firstName: 'Gardien',
					lastName: 'Test',
					age: 30,
					jerseyNumber: null,
					avatarId: 'legende-lafleur'
				}
			)
		).rejects.toMatchObject({ key: 'error.identityWrongPosition' });
		expect(playerRow('goalie').avatar_id).toBe('masque-debutant');
	});

	it('refuse Lafleur à un gardien par la fiche admin', async () => {
		addPlayer('goalie', { position: 'goalie', avatarId: 'masque-debutant' });

		await expect(
			adminUpdatePlayer(admin, 'goalie', {
				position: 'goalie',
				avatarId: 'legende-lafleur'
			})
		).rejects.toMatchObject({ key: 'error.identityWrongPosition' });
		expect(playerRow('goalie').avatar_id).toBe('masque-debutant');
	});

	it('refuse un changement de poste qui rendrait la légende incompatible', async () => {
		addPlayer('forward', { position: 'forward', avatarId: 'legende-lafleur' });

		await expect(
			adminUpdatePlayer(admin, 'forward', { position: 'goalie' })
		).rejects.toMatchObject({ key: 'error.identityWrongPosition' });
		expect(playerRow('forward').position).toBe('forward');
	});

	it('garde une incompatibilité déjà enregistrée lisible et signalable', () => {
		addPlayer('saved', { position: 'goalie', avatarId: 'legende-lafleur' });

		const profile = getOwnProfile({
			kind: 'user',
			userId: 'saved',
			name: 'Sauvé',
			role: 'player',
			active: true
		});
		const picker = getOwnAvatarPicker({
			kind: 'user',
			userId: 'saved',
			name: 'Sauvé',
			role: 'player',
			active: true
		});

		expect(profile.position).toBe('goalie');
		expect(profile.avatarId).toBe('legende-lafleur');
		expect(picker.selected).toBe('legende-lafleur');
		expect(identityAllowedForPosition('legende-lafleur', 'goalie')).toBe(false);
	});
});
