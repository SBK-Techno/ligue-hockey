/**
 * Remplit une base avec un jeu de données de démonstration.
 *
 * Le script n'écrit que des lignes marquées `demo_` ou des comptes
 * `@demo.liguehockey.local`. Il peut donc être relancé: son propre jeu est
 * remplacé, et rien d'autre n'est touché. Les matchs réels déjà présents sont
 * conservés et reçoivent une présence et un alignement.
 *
 * Les alignements passent par le sélecteur et le générateur de la ligue, donc
 * les postes, la capacité et les règles de paires restent ceux du produit.
 *
 * Utilisation:
 *   ORIGIN=http://localhost:5173 \
 *   BETTER_AUTH_SECRET=... \
 *   DATABASE_URL=./data/ligue.db \
 *   npx tsx scripts/seed-demo.ts --yes
 */

import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, notLike } from 'drizzle-orm';
import {
	POSITION_RATING_ATTRIBUTES,
	RATING_ATTRIBUTE_KEYS,
	gameRatingAttributes,
	overallRating
} from '#config/rating-attributes.ts';
import { AVATAR_IDS } from '#config/avatars.ts';
import { buildSlotDefinitions, type RosterTemplate } from '#config/roster.ts';
import { slotKey, slotRowId } from '#config/slot.ts';
import {
	NOTIFICATION_EVENTS,
	type NotificationEventKey
} from '#config/notification-events.ts';
import { parseSettings } from '#config/settings-registry.ts';
import type { Position } from '#config/positions.ts';
import type { GameStatus } from '#lib/domain/games/schema.ts';
import { gameAvailability, gameSlots, games } from '#lib/domain/games/schema.ts';
import { selectGenerationPlayers, type SelectionCandidate } from '#lib/domain/games/selection.ts';
import { generationSnapshotSchema } from '#lib/domain/games/validators.ts';
import { players } from '#lib/domain/players/schema.ts';
import { gamePlayerRatings, playerRatings } from '#lib/domain/ratings/schema.ts';
import { paymentPlans, payments } from '#lib/domain/finance/schema.ts';
import { chatMessages, pollOptions, pollVotes, polls } from '#lib/domain/chat/schema.ts';
import { pairRules } from '#lib/domain/rules/schema.ts';
import { leagueSettings } from '#lib/domain/settings/schema.ts';
import { locations as locationsTable } from '#lib/domain/locations/schema.ts';
import { notificationJobs } from '#lib/domain/notifications/schema.ts';
import { subProfiles, subRequests } from '#lib/domain/subs/schema.ts';
import {
	generateTeams,
	type GeneratorPlayer,
	type GeneratorRule
} from '#lib/domain/teams/generator.ts';
import { branding } from '#lib/generated/branding.ts';
import { account, user } from '#lib/server/db/auth.schema.ts';
import { addDays, clock, todayInZone, zonedDateTimeToMs } from '#lib/shared/time/clock.ts';
import { CHAT_LINES, LOCATIONS, PLAYERS, POLLS, RULES } from './demo/catalogue.ts';
import { scriptEnv } from './lib/env.ts';
import { migrateDatabase, openDatabase } from './lib/db.ts';

const TZ = branding.timezone;
const EMAIL_DOMAIN = 'demo.liguehockey.local';
const PREFIX = 'demo_';
const DEMO_EMAIL = `'%@${EMAIL_DOMAIN}'`;
const DEMO_USERS = `select id from user where email like ${DEMO_EMAIL}`;
const DEMO_PLAYERS = `select user_id from players where user_id in (${DEMO_USERS})`;

/** Une ligue de garage: deux équipes de six, une glace le dimanche matin. */
const TEMPLATE: RosterTemplate = { goaliesPerTeam: 1, forwardsPerTeam: 3, defensePerTeam: 2 };
const GAME_TIME = '08:30';

const SETTINGS: Record<string, unknown> = {
	'league.seasonLabel': 'Saison 2026-2027',
	'games.defaultStartTime': GAME_TIME,
	'finance.totalCents': 24_000,
	'finance.firstInstallmentPercent': 50,
	'finance.installment1Due': '2026-09-15',
	'finance.installment2Due': '2026-11-01',
	'finance.goalieDiscountPercent': 50,
	'finance.overdueGraceDays': 7
};

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

type Options = { reset: boolean; seed: number; password: string };

function parseOptions(argv: readonly string[]): Options {
	let reset = true;
	let seed = 20_261_116;
	let password = '';

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--yes') continue;
		if (arg === '--keep') reset = false;
		else if (arg === '--seed') seed = Number(argv[++index]);
		else if (arg === '--password') password = argv[++index] ?? '';
		else if (arg === '--help') {
			console.log('Options: --yes --keep --seed N --password X');
			process.exit(0);
		} else throw new Error(`Option inconnue: ${arg}`);
	}

	if (!argv.includes('--yes')) {
		throw new Error('Relance avec --yes pour confirmer la base cible.');
	}
	if (!Number.isInteger(seed)) throw new Error('--seed doit être un entier.');
	if (password.length < 12) {
		throw new Error('--password est requis (12 caractères minimum) pour les comptes de démonstration.');
	}

	return { reset, seed, password };
}

const options = parseOptions(process.argv.slice(2));

// ---------------------------------------------------------------------------
// Aléa déterministe
// ---------------------------------------------------------------------------

function random(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}

const next = random(options.seed);
const between = (min: number, max: number) => min + next() * (max - min);
const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
const clamp = (value: number) => Math.max(1, Math.min(5, Math.round(value)));

function shuffle<T>(items: readonly T[]): T[] {
	const copy = [...items];
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(next() * (index + 1));
		[copy[index], copy[swap]] = [copy[swap], copy[index]];
	}
	return copy;
}

// ---------------------------------------------------------------------------
// Temps
// ---------------------------------------------------------------------------

const today = todayInZone(TZ);
const now = clock.nowMs();
const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
const lastSunday = addDays(today, weekday === 0 ? 0 : -weekday);
const gameStart = (date: string) => zonedDateTimeToMs(date, GAME_TIME, TZ);

// ---------------------------------------------------------------------------
// Modèle
// ---------------------------------------------------------------------------

type DemoPlayerRow = {
	userId: string;
	fullName: string;
	email: string;
	position: Position;
	age: number;
	jersey: number;
	substitute: boolean;
	login: boolean;
	overall: number | null;
	skill: Record<string, number>;
};

type PlannedGame = {
	id: string;
	gameDate: string;
	status: GameStatus;
	adopted: { locationId: string; location: string } | null;
	locationId: string;
	location: string;
};

const settings = parseSettings(SETTINGS);
const slotDefinitions = buildSlotDefinitions(TEMPLATE);

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

migrateDatabase();
const { sqlite, db } = openDatabase();

console.log(`Base cible: ${scriptEnv.DATABASE_URL}`);
console.log(`Date de référence: ${today} (${TZ})`);

if (options.reset) {
	sqlite.exec(`
		delete from sub_requests where id like '${PREFIX}%' or game_id like '${PREFIX}%'
			or requested_by_player_id in (${DEMO_PLAYERS}) or filled_by_player_id in (${DEMO_PLAYERS});
		delete from payments where player_id in (${DEMO_PLAYERS});
		delete from payment_plans where player_id in (${DEMO_PLAYERS});
		delete from pair_rules where player_a_id in (${DEMO_PLAYERS}) or player_b_id in (${DEMO_PLAYERS});
		delete from chat_messages where id like '${PREFIX}%' or author_user_id in (${DEMO_USERS});
		delete from notification_jobs where id like '${PREFIX}%';
		delete from games where id like '${PREFIX}%';
		update game_slots set assigned_player_id = null, assignment_kind = null
			where assigned_player_id in (${DEMO_PLAYERS});
		delete from user where email like ${DEMO_EMAIL};
	`);
	console.log('Jeu de démonstration précédent retiré.');
}

const admin = db
	.select({ id: user.id })
	.from(user)
	.where(eq(user.role, 'admin'))
	.get();
if (!admin) throw new Error('Aucun compte administrateur dans cette base.');

// ---------------------------------------------------------------------------
// Comptes et joueurs
// ---------------------------------------------------------------------------

/**
 * Le catalogue décrit la ligue au complet: le seed ne choisit personne.
 * Une dérive du fichier de données arrête le script au lieu de produire une
 * saison incomplète.
 */
function checkCatalogue(): void {
	const counts = { forward: 0, defense: 0, goalie: 0 };
	for (const player of PLAYERS) counts[player.position] += 1;
	if (PLAYERS.length !== 28) throw new Error(`Catalogue: ${PLAYERS.length} joueurs au lieu de 28.`);
	if (counts.forward !== 14 || counts.defense !== 10 || counts.goalie !== 4) {
		throw new Error(`Catalogue: répartition ${JSON.stringify(counts)}.`);
	}
	if (PLAYERS.filter((player) => player.login).length !== 4) {
		throw new Error('Catalogue: quatre comptes de connexion attendus.');
	}
	if (new Set(PLAYERS.map((player) => player.jersey)).size !== PLAYERS.length) {
		throw new Error('Catalogue: numéros de chandail en double.');
	}
}

checkCatalogue();

// Le mot de passe vient de l'opérateur et n'est jamais écrit dans les journaux.
const loginHash = await hashPassword(options.password);
const fillerHash = await hashPassword(randomUUID());

const demoPlayers: DemoPlayerRow[] = [];
const order = new Map<string, number>();

for (const [index, entry] of PLAYERS.entries()) {
	const userId = `${PREFIX}user_${String(index + 1).padStart(2, '0')}`;
	const fullName = `${entry.firstName} ${entry.lastName}`;
	const email = `${fullName}`
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '.')
		.replace(/^\.|\.$/g, '') + `@${EMAIL_DOMAIN}`;
	const base = between(2.1, 4.7);
	const skill: Record<string, number> = {};

	for (const attribute of RATING_ATTRIBUTE_KEYS) {
		skill[attribute] = clamp(base + between(-0.9, 0.9));
	}
	for (const attribute of POSITION_RATING_ATTRIBUTES[entry.position]) {
		skill[attribute.key] = clamp(base + between(-1, 1));
	}

	const unrated = index >= PLAYERS.length - 2;
	const createdAt = now - Math.round(between(20, 400) * 86_400_000);

	db.insert(user)
		.values({
			id: userId,
			name: fullName,
			email,
			emailVerified: true,
			createdAt: new Date(createdAt),
			updatedAt: new Date(now),
			role: index === 1 ? 'manager' : 'player'
		})
		.run();

	db.insert(account)
		.values({
			id: `${PREFIX}account_${String(index + 1).padStart(2, '0')}`,
			accountId: userId,
			providerId: 'credential',
			userId,
			password: entry.login ? loginHash : fillerHash,
			createdAt: new Date(now),
			updatedAt: new Date(now)
		})
		.run();

	db.insert(players)
		.values({
			userId,
			firstName: entry.firstName,
			lastName: entry.lastName,
			position: entry.position,
			age: entry.age,
			jerseyNumber: entry.jersey,
			avatarId: AVATAR_IDS[index % AVATAR_IDS.length],
			isSubstitute: entry.substitute,
			active: true,
			createdAt: now,
			updatedAt: now
		})
		.run();

	order.set(userId, index);
	demoPlayers.push({
		userId,
		fullName,
		email,
		position: entry.position,
		age: entry.age,
		jersey: entry.jersey,
		substitute: entry.substitute,
		login: entry.login,
		overall: unrated ? null : overallRating(skill),
		skill
	});
}

const regulars = demoPlayers.filter((player) => !player.substitute);
const substitutes = demoPlayers.filter((player) => player.substitute);

for (const [index, substitute] of substitutes.entries()) {
	db.insert(subProfiles)
		.values({
			playerId: substitute.userId,
			favorite: index < 2,
			positionsJson: JSON.stringify([substitute.position]),
			createdAt: now,
			updatedAt: now
		})
		.run();
}

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------

for (const [key, value] of Object.entries(SETTINGS)) {
	const valueJson = JSON.stringify(value);
	db.insert(leagueSettings)
		.values({ key, valueJson, updatedAt: now, updatedBy: admin.id })
		.onConflictDoUpdate({
			target: leagueSettings.key,
			set: { valueJson, updatedAt: now, updatedBy: admin.id }
		})
		.run();
}

// ---------------------------------------------------------------------------
// Glaces
// ---------------------------------------------------------------------------

type Venue = { id: string; name: string };

const existingVenues = db
	.select({ id: locationsTable.id, name: locationsTable.name })
	.from(locationsTable)
	.all();

const venues: Venue[] = [...existingVenues];

// Une base neuve reçoit les glaces du catalogue; une base existante garde les siennes.
for (const [index, location] of LOCATIONS.entries()) {
	if (venues.length >= 2) break;
	const id = `${PREFIX}loc_${index + 1}`;
	db.insert(locationsTable)
		.values({
			id,
			name: location.name,
			address: location.address,
			mapUrl: null,
			notes: location.notes,
			createdAt: now,
			updatedAt: now
		})
		.run();
	venues.push({ id, name: location.name });
}

if (venues.length === 0) throw new Error('Aucune glace disponible.');

// ---------------------------------------------------------------------------
// Horaire
// ---------------------------------------------------------------------------

const existingGames = db
	.select({
		id: games.id,
		gameDate: games.gameDate,
		startTime: games.startTime,
		locationId: games.locationId,
		location: games.location
	})
	.from(games)
	.where(and(notLike(games.id, `${PREFIX}%`), eq(games.status, 'scheduled')))
	.all();

const adopted = new Map(existingGames.map((game) => [`${game.gameDate}|${game.startTime}`, game]));
const planned: PlannedGame[] = [];

// Douze dimanches passés, huit à venir: une saison de garage.
for (let weeksAgo = 12; weeksAgo >= -8; weeksAgo -= 1) {
	const gameDate = addDays(lastSunday, -7 * weeksAgo);
	const match = adopted.get(`${gameDate}|${GAME_TIME}`);
	const venue = venues[Math.abs(weeksAgo) % venues.length];

	planned.push({
		id: match?.id ?? `${PREFIX}game_${gameDate.replaceAll('-', '_')}`,
		gameDate,
		status: weeksAgo >= 0 ? 'completed' : 'scheduled',
		adopted: match ? { locationId: match.locationId, location: match.location } : null,
		locationId: match?.locationId ?? venue.id,
		location: match?.location ?? venue.name
	});
}

// Un dimanche annulé montre l'état sans casser l'horaire.
const cancelled = planned.find((game) => game.status === 'completed');
if (cancelled) cancelled.status = 'cancelled';

// Les lignes existent avant la présence: la clé étrangère l'exige.
for (const game of planned) {
	if (game.adopted) continue;
	db.insert(games)
		.values({
			id: game.id,
			gameDate: game.gameDate,
			startTime: GAME_TIME,
			locationId: game.locationId,
			location: game.location,
			notes: null,
			status: game.status,
			completedAt:
				game.status === 'completed' ? gameStart(game.gameDate) + 2 * 3_600_000 : null,
			rosterTemplateJson: JSON.stringify(TEMPLATE),
			generatedAt: null,
			generationJson: null,
			createdBy: admin.id,
			createdAt: Math.min(now, gameStart(game.gameDate) - 21 * 86_400_000),
			updatedAt: now
		})
		.run();
}

// ---------------------------------------------------------------------------
// Présence
// ---------------------------------------------------------------------------

type Answer = 'present' | 'absent' | null;

const habit = new Map(demoPlayers.map((player) => [player.userId, between(0.62, 0.97)]));

function answerFor(game: PlannedGame, player: DemoPlayerRow): Answer {
	if (player.substitute) return null;
	const base = (habit.get(player.userId) ?? 0.8) + (player.position === 'goalie' ? 0.1 : 0);
	if (game.status === 'cancelled') return next() < 0.5 ? 'present' : 'absent';
	const present = next() < base;
	if (game.status === 'completed') return present ? 'present' : 'absent';
	if (next() < 0.15) return null;
	return present ? 'present' : 'absent';
}

const answers = new Map<string, Map<string, Answer>>();

for (const game of planned) {
	const rows = new Map<string, Answer>();
	for (const player of regulars) rows.set(player.userId, answerFor(game, player));
	answers.set(game.id, rows);

	const answered = [...rows.entries()].filter(([, status]) => status !== null);
	if (answered.length === 0) continue;

	db.insert(gameAvailability)
		.values(
			answered.map(([playerId, status]) => ({
				gameId: game.id,
				playerId,
				status: status as 'present' | 'absent',
				updatedAt: now
			}))
		)
		.run();
}

// ---------------------------------------------------------------------------
// Règles de paires
// ---------------------------------------------------------------------------

type RuleSeed = { pair: [number, number]; kind: 'must' | 'must_not'; strict: boolean };

const ruleSeeds: RuleSeed[] = [
	...RULES.together.map((pair) => ({ pair, kind: 'must' as const, strict: true })),
	...RULES.apart.map((pair) => ({ pair, kind: 'must_not' as const, strict: true })),
	...RULES.preferApart.map((pair) => ({ pair, kind: 'must_not' as const, strict: false }))
];

const generatorRules: GeneratorRule[] = [];

for (const [index, seed] of ruleSeeds.entries()) {
	const first = demoPlayers[seed.pair[0]]?.userId;
	const second = demoPlayers[seed.pair[1]]?.userId;
	if (!first || !second || first === second) continue;
	const [a, b] = first < second ? [first, second] : [second, first];
	const id = `${PREFIX}rule_${index + 1}`;

	db.insert(pairRules)
		.values({
			id,
			playerAId: a,
			playerBId: b,
			kind: seed.kind,
			strict: seed.strict,
			createdAt: now,
			createdBy: admin.id
		})
		.run();

	generatorRules.push({ id, playerAId: a, playerBId: b, kind: seed.kind, strict: seed.strict });
}

// ---------------------------------------------------------------------------
// Alignement
// ---------------------------------------------------------------------------

type Fill = { gameId: string; position: Position; substitute: DemoPlayerRow; absentId: string };

const fills: Fill[] = [];
const completed = planned.filter((game) => game.status === 'completed');

for (const position of ['forward', 'defense'] as const) {
	for (const game of completed) {
		const rows = answers.get(game.id);
		const absent = regulars.find(
			(player) => player.position === position && rows?.get(player.userId) === 'absent'
		);
		const substitute = substitutes.find(
			(player) => player.position === position && !fills.some((fill) => fill.substitute === player)
		);
		if (!absent || !substitute) continue;
		fills.push({ gameId: game.id, position, substitute, absentId: absent.userId });
		break;
	}
}

function candidatesFor(game: PlannedGame): SelectionCandidate[] {
	const rows = answers.get(game.id) ?? new Map<string, Answer>();
	const candidates: SelectionCandidate[] = [];

	for (const player of regulars) {
		if (rows.get(player.userId) !== 'present' || player.overall === null) continue;
		candidates.push({
			playerId: player.userId,
			position: player.position,
			eligiblePositions: [player.position],
			kind: 'regular',
			order: order.get(player.userId) ?? 0
		});
	}

	for (const fill of fills) {
		if (fill.gameId !== game.id) continue;
		candidates.push({
			playerId: fill.substitute.userId,
			position: fill.substitute.position,
			eligiblePositions: [fill.substitute.position],
			kind: 'sub',
			order: order.get(fill.substitute.userId) ?? 0
		});
	}

	return candidates;
}

function writeGameRatings(gameId: string, dressed: readonly string[]): void {
	const rows = [];
	for (const playerId of dressed) {
		const player = demoPlayers.find((entry) => entry.userId === playerId);
		if (!player || next() < 0.1) continue;
		const attributes = gameRatingAttributes(player.position);
		const count = next() < 0.15 ? attributes.length - 1 : attributes.length;
		for (const [index, attribute] of attributes.entries()) {
			if (index >= count) break;
			rows.push({
				gameId,
				playerId,
				attribute: attribute.key,
				value: clamp((player.overall ?? 3) + between(-0.7, 0.7)),
				updatedAt: now,
				updatedBy: admin.id
			});
		}
	}
	if (rows.length > 0) db.insert(gamePlayerRatings).values(rows).run();
}

for (const game of planned) {
	db.delete(gameSlots).where(eq(gameSlots.gameId, game.id)).run();

	if (game.status === 'cancelled') {
		db.update(games)
			.set({ status: 'cancelled', generatedAt: null, generationJson: null, updatedAt: now })
			.where(eq(games.id, game.id))
			.run();
		continue;
	}

	const selection = selectGenerationPlayers(candidatesFor(game), TEMPLATE);
	const generatedAt = Math.min(
		now - 2 * 86_400_000,
		gameStart(game.gameDate) - 2 * 86_400_000
	);

	const result = generateTeams({
		players: selection.selected.map((candidate) => {
			const player = demoPlayers.find((entry) => entry.userId === candidate.playerId);
			return {
				id: candidate.playerId,
				position: candidate.selectionPosition,
				age: player?.age ?? 30,
				overall: player?.overall ?? 3,
				kind: candidate.kind
			} satisfies GeneratorPlayer;
		}),
		template: TEMPLATE,
		rules: generatorRules,
		skillTolerance: settings['teams.skillTolerance'],
		maxPlayers: settings['teams.maxPlayers'],
		limits: {
			skill: settings['teams.maxSkillSpread'],
			age: settings['teams.maxAgeSpread'],
			size: settings['teams.maxSizeSpread']
		}
	});

	const kinds = new Map(selection.selected.map((candidate) => [candidate.playerId, candidate.kind]));
	const snapshot = generationSnapshotSchema.parse({
		skillDiff: result.skillDiff,
		ageDiff: result.ageDiff,
		sizeDiff: result.sizeDiff,
		warnings: result.warnings,
		ruleViolations: result.violations.map((violation) => ({
			ruleId: violation.ruleId,
			kind: violation.kind,
			strict: violation.strict,
			playerIds: violation.playerIds
		})),
		bench: selection.bench.map((candidate) => ({
			playerId: candidate.playerId,
			position: candidate.position,
			kind: candidate.kind
		})),
		candidateKey: result.candidateKey,
		generatedAt
	});

	db.update(games)
		.set({
			status: game.status,
			completedAt:
				game.status === 'completed' ? gameStart(game.gameDate) + 2 * 3_600_000 : null,
			rosterTemplateJson: JSON.stringify(TEMPLATE),
			generatedAt,
			generationJson: JSON.stringify(snapshot),
			updatedAt: now
		})
		.where(eq(games.id, game.id))
		.run();

	const assignments = new Map(
		result.assignments.map((assignment) => [
			slotKey(assignment),
			assignment
		])
	);

	db.insert(gameSlots)
		.values(
			slotDefinitions.map((slot) => {
				const slotRef = {
					team: slot.team,
					position: slot.position,
					slotIndex: slot.index
				};
				const assignment = assignments.get(slotKey(slotRef));
				return {
					id: slotRowId(game.id, slotRef),
					gameId: game.id,
					team: slot.team,
					position: slot.position,
					slotIndex: slot.index,
					assignedPlayerId: assignment?.playerId ?? null,
					assignmentKind: assignment ? (kinds.get(assignment.playerId) ?? 'regular') : null,
					createdAt: now,
					updatedAt: now
				};
			})
		)
		.run();

	if (game.status === 'completed') {
		writeGameRatings(
			game.id,
			selection.selected.map((candidate) => candidate.playerId)
		);
	}
}

// ---------------------------------------------------------------------------
// Notes de saison
// ---------------------------------------------------------------------------

const seasonRows = [];

for (const player of demoPlayers) {
	if (player.overall === null) continue;
	for (const [attribute, value] of Object.entries(player.skill)) {
		seasonRows.push({
			playerId: player.userId,
			attribute,
			value,
			updatedAt: now,
			updatedBy: admin.id
		});
	}
}

db.insert(playerRatings).values(seasonRows).run();

// ---------------------------------------------------------------------------
// Finances
// ---------------------------------------------------------------------------

const totalCents = settings['finance.totalCents'];
const firstDue = settings['finance.installment1Due'] ?? '2026-09-15';
const secondDue = settings['finance.installment2Due'] ?? '2026-11-01';
const discount = settings['finance.goalieDiscountPercent'];

for (const [index, player] of demoPlayers.entries()) {
	const total =
		player.position === 'goalie'
			? Math.round((totalCents * (100 - discount)) / 100 / 100) * 100
			: totalCents;
	const first =
		Math.round((total * settings['finance.firstInstallmentPercent']) / 100 / 100) * 100;
	const second = total - first;
	const suffix = String(index + 1).padStart(2, '0');

	db.insert(paymentPlans)
		.values({
			id: `${PREFIX}plan_${suffix}`,
			playerId: player.userId,
			totalCents: total,
			firstCents: first,
			secondCents: second,
			firstDueDate: firstDue,
			secondDueDate: secondDue,
			createdAt: now,
			updatedAt: now
		})
		.run();

	const paidFirst = next() < 0.86;
	const paidSecond = paidFirst && next() < 0.58;
	const rows = [];

	if (paidFirst) {
		rows.push({
			id: `${PREFIX}pay_${suffix}_1`,
			playerId: player.userId,
			amountCents: first,
			paidAt: firstDue,
			method: pick(['etransfer', 'etransfer', 'cash', 'card'] as const),
			note: null,
			recordedBy: admin.id,
			createdAt: now
		});
	}
	if (paidSecond) {
		rows.push({
			id: `${PREFIX}pay_${suffix}_2`,
			playerId: player.userId,
			amountCents: second,
			paidAt: secondDue,
			method: pick(['etransfer', 'cash', 'other'] as const),
			note: next() < 0.2 ? 'Comptant remis au local' : null,
			recordedBy: admin.id,
			createdAt: now
		});
	}
	if (rows.length > 0) db.insert(payments).values(rows).run();
}

// ---------------------------------------------------------------------------
// Discussion
// ---------------------------------------------------------------------------

for (const [index, line] of CHAT_LINES.entries()) {
	const author = demoPlayers[line.author];
	if (!author) continue;
	const date = addDays(today, -line.daysAgo);
	const minute = Math.floor(next() * 60);

	db.insert(chatMessages)
		.values({
			id: `${PREFIX}msg_${String(index + 1).padStart(3, '0')}`,
			authorUserId: author.userId,
			kind: 'text',
			body: line.body,
			createdAt: zonedDateTimeToMs(
				date,
				`${String(line.hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
				TZ
			),
			deletedAt: null,
			deletedBy: null
		})
		.run();
}

for (const [index, poll] of POLLS.entries()) {
	const author = demoPlayers[poll.author];
	if (!author) continue;
	const messageId = `${PREFIX}poll_${String(index + 1).padStart(2, '0')}`;
	const createdAt = zonedDateTimeToMs(addDays(today, -poll.daysAgo), '19:00', TZ);
	const optionIds = poll.options.map((_, option) => `${PREFIX}opt_${index + 1}_${option + 1}`);

	db.insert(chatMessages)
		.values({
			id: messageId,
			authorUserId: author.userId,
			kind: 'poll',
			body: null,
			createdAt,
			deletedAt: null,
			deletedBy: null
		})
		.run();

	db.insert(polls)
		.values({
			messageId,
			question: poll.question,
			closesAt:
				poll.closesInDays === null ? null : createdAt + poll.closesInDays * 86_400_000,
			createdAt
		})
		.run();

	db.insert(pollOptions)
		.values(
			poll.options.map((label, option) => ({
				id: optionIds[option],
				messageId,
				label,
				optionIndex: option
			}))
		)
		.run();

	const voters = shuffle(demoPlayers).slice(
		0,
		Math.min(demoPlayers.length, poll.votes.reduce((sum, count) => sum + count, 0))
	);
	let cursor = 0;
	for (const [option, count] of poll.votes.entries()) {
		const slice = voters.slice(cursor, cursor + count);
		cursor += count;
		if (slice.length === 0) continue;
		db.insert(pollVotes)
			.values(
				slice.map((voter) => ({
					messageId,
					optionId: optionIds[option],
					userId: voter.userId,
					createdAt: createdAt + 3_600_000
				}))
			)
			.run();
	}
}

// ---------------------------------------------------------------------------
// Demandes de remplaçant
// ---------------------------------------------------------------------------

for (const [index, fill] of fills.entries()) {
	const game = planned.find((entry) => entry.id === fill.gameId);
	if (!game) continue;

	db.insert(subRequests)
		.values({
			id: `${PREFIX}req_filled_${index + 1}`,
			gameId: game.id,
			requestedByPlayerId: fill.absentId,
			createdByUserId: fill.absentId,
			position: fill.position,
			reason: 'absence',
			status: 'filled',
			createdAt: gameStart(game.gameDate) - 4 * 86_400_000,
			filledByPlayerId: fill.substitute.userId,
			filledAt: gameStart(game.gameDate) - 3 * 86_400_000,
			cancelledAt: null
		})
		.run();
}

let openSequence = 0;

for (const game of planned.filter((entry) => entry.status === 'scheduled').slice(0, 3)) {
	const rows = answers.get(game.id);
	if (!rows) continue;
	const absent = regulars.filter((player) => rows.get(player.userId) === 'absent');

	for (const player of shuffle(absent).slice(0, 2)) {
		openSequence += 1;
		db.insert(subRequests)
			.values({
				id: `${PREFIX}req_open_${String(openSequence).padStart(2, '0')}`,
				gameId: game.id,
				requestedByPlayerId: player.userId,
				createdByUserId: player.userId,
				position: player.position,
				reason: 'absence',
				status: 'open',
				createdAt: now - openSequence * 3_600_000,
				filledByPlayerId: null,
				filledAt: null,
				cancelledAt: null
			})
			.run();
	}
}

const cancelledTarget = planned.find((game) => game.status === 'scheduled');
const cancelledRequester = regulars.find(
	(player) => answers.get(cancelledTarget?.id ?? '')?.get(player.userId) === 'absent'
);

if (cancelledTarget && cancelledRequester) {
	db.insert(subRequests)
		.values({
			id: `${PREFIX}req_cancelled`,
			gameId: cancelledTarget.id,
			requestedByPlayerId: cancelledRequester.userId,
			createdByUserId: cancelledRequester.userId,
			position: cancelledRequester.position,
			reason: 'absence',
			status: 'cancelled',
			createdAt: now - 6 * 86_400_000,
			filledByPlayerId: null,
			filledAt: null,
			cancelledAt: now - 5 * 86_400_000
		})
		.run();
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

type InAppRow = typeof notificationJobs.$inferInsert;
const inAppRows: InAppRow[] = [];
let notificationIndex = 0;

/**
 * Une notification lue est une ligne `sent` avec `readAt`. Le planificateur ne
 * ramasse que les lignes `pending`, donc rien ne part par courriel.
 */
function inApp(
	userId: string,
	eventKey: NotificationEventKey,
	payload: unknown,
	createdAt: number,
	read: boolean
): void {
	const definition = NOTIFICATION_EVENTS[eventKey] as {
		schema: { parse: (value: unknown) => unknown };
	};
	const valid = definition.schema.parse(payload);
	notificationIndex += 1;
	const suffix = String(notificationIndex).padStart(3, '0');
	inAppRows.push({
		id: `${PREFIX}notif_${suffix}`,
		eventKey,
		userId,
		channel: 'in_app',
		scheduledFor: createdAt,
		status: 'sent',
		payloadJson: JSON.stringify(valid),
		dedupeKey: `${PREFIX}notif_${suffix}`,
		attempts: 1,
		lastError: null,
		createdAt,
		sentAt: createdAt,
		claimedAt: null,
		readAt: read ? createdAt + 3_600_000 : null
	});
}

const cancelledGame = planned.find((game) => game.status === 'cancelled');
if (cancelledGame) {
	const everyone = [...demoPlayers];
	const realUsers = db.select({ id: user.id }).from(user).where(notLike(user.email, `%@${EMAIL_DOMAIN}`)).all();
	for (const target of [...everyone, ...realUsers.map((entry) => ({ userId: entry.id, login: false }))]) {
		inApp(
			target.userId,
			'game_cancelled',
			{
				gameId: cancelledGame.id,
				gameDate: cancelledGame.gameDate,
				startTime: GAME_TIME,
				location: cancelledGame.location
			},
			gameStart(cancelledGame.gameDate) - 6 * 86_400_000,
			!target.login
		);
	}
}

const paidTotals = new Map<string, number>();
for (const row of db
	.select({ playerId: payments.playerId, amountCents: payments.amountCents })
	.from(payments)
	.all()) {
	paidTotals.set(row.playerId, (paidTotals.get(row.playerId) ?? 0) + row.amountCents);
}

const overdue = db
	.select({
		playerId: paymentPlans.playerId,
		totalCents: paymentPlans.totalCents,
		firstCents: paymentPlans.firstCents,
		firstDueDate: paymentPlans.firstDueDate,
		secondDueDate: paymentPlans.secondDueDate
	})
	.from(paymentPlans)
	.all();

for (const plan of overdue) {
	const paid = paidTotals.get(plan.playerId) ?? 0;
	const firstDue = plan.firstDueDate ?? '';
	const secondDue = plan.secondDueDate ?? '';
	let amountCents = 0;
	let dueDate = '';

	if (paid < plan.firstCents && firstDue !== '' && firstDue < today) {
		amountCents = plan.firstCents - paid;
		dueDate = firstDue;
	} else if (paid < plan.totalCents && secondDue !== '' && secondDue < today) {
		amountCents = plan.totalCents - paid;
		dueDate = secondDue;
	}

	if (amountCents === 0 || dueDate === '') continue;
	inApp(
		plan.playerId,
		'balance_overdue',
		{ amountCents, currency: 'CAD', dueDate },
		now - 2 * 86_400_000,
		next() < 0.5
	);
}

for (const fill of fills) {
	const game = planned.find((entry) => entry.id === fill.gameId);
	if (!game) continue;
	inApp(
		fill.absentId,
		'sub_claimed',
		{
			gameId: game.id,
			position: fill.position,
			playerName: fill.substitute.fullName,
			gameDate: game.gameDate,
			startTime: GAME_TIME
		},
		gameStart(game.gameDate) - 3 * 86_400_000,
		true
	);
}

if (inAppRows.length > 0) db.insert(notificationJobs).values(inAppRows).run();

// ---------------------------------------------------------------------------
// Contrôle et résumé
// ---------------------------------------------------------------------------

const broken = sqlite.prepare('pragma foreign_key_check').all();
if (broken.length > 0) {
	throw new Error(`Clés étrangères cassées: ${JSON.stringify(broken.slice(0, 5))}`);
}

const count = (table: string) =>
	(sqlite.prepare(`select count(*) as c from "${table}"`).get() as { c: number }).c;

console.log('');
console.log('Jeu de démonstration écrit.');
console.log(`  joueurs:          ${count('players')} (${demoPlayers.length} de démonstration)`);
console.log(`  matchs:           ${count('games')}`);
console.log(`  présences:        ${count('game_availability')}`);
console.log(`  places:           ${count('game_slots')}`);
console.log(`  notes de saison:  ${count('player_ratings')}`);
console.log(`  notes de match:   ${count('game_player_ratings')}`);
console.log(`  paiements:        ${count('payments')}`);
console.log(`  messages:         ${count('chat_messages')}`);
console.log(`  demandes:         ${count('sub_requests')}`);
console.log(`  notifications:    ${count('notification_jobs')}`);
console.log(`  règles de paires: ${count('pair_rules')}`);
console.log('');

const logins = demoPlayers.filter((player) => player.login);
if (logins.length > 0) {
	console.log('Comptes de démonstration (mot de passe fourni avec --password):');
	for (const player of logins) console.log(`  ${player.email}  (${player.fullName})`);
	console.log('');
}

sqlite.close();
