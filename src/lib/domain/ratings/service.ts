import {
	RATING_ATTRIBUTE_KEYS,
	gameRatingAttributes,
	isGameRatingAttribute,
	isRatingValue,
	meanRating,
	overallRating,
	positionRatingAttributes,
	type GameRatingAttribute,
	type PositionRatingAttribute,
	type RatingAttribute,
	type RatingValues
} from '#config/rating-attributes.ts';
import { RATING_FORM_WINDOW } from '#config/ratings.ts';
import type { Position } from '#config/positions.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { getGame, listSchedule } from '#lib/domain/games/service.ts';
import { isGamePlayable } from '#lib/domain/games/playability.ts';
import { regenerateUpcomingGeneratedGames } from '#lib/domain/games/upcoming.ts';
import {
	listAdminPlayers,
	getPlayer
} from '#lib/domain/players/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import {
	listGameRatings,
	listPlayerGameRatings,
	listRatings,
	listRatingsForPlayers,
	replaceGameRatings,
	upsertRatings,
	type GameRatingRow
} from './queries.ts';
import { ratingsInputSchema, type RatingsInput } from './validators.ts';

export type RatingsForm = {
	average: number | null;
	games: number;
};

export type RatingsView = {
	playerId: string;
	values: RatingValues;
	overall: number | null;
	positionValues: Record<string, number>;
	positionOverall: number | null;
	positionComplete: boolean;
	positionTotal: number;
	form: RatingsForm;
	updatedAt: number | null;
};

export type EvaluationOverview = {
	playerId: string;
	fullName: string;
	position: Position;
	overall: number | null;
	positionCompleted: number;
	positionTotal: number;
	complete: boolean;
	updatedAt: number | null;
};

export type GameAssessmentPlayer = {
	playerId: string;
	fullName: string;
	position: Position;
	jerseyNumber: number | null;
	values: Partial<Record<GameRatingAttribute, number>>;
	rated: number;
	total: number;
	complete: boolean;
	/** Révision serveur : une sauvegarde remonte cette clé et remonte le formulaire. */
	version: number;
};

export type GameAssessmentView = {
	gameId: string;
	gameDate: string;
	startTime: string;
	location: string;
	status: string;
	canRate: boolean;
	players: GameAssessmentPlayer[];
	ratedPlayers: number;
	totalPlayers: number;
};

type AssessmentGame = {
	id: string;
	gameDate: string;
	startTime: string;
	location: string;
	status: string;
	generated: boolean;
	slots: {
		player: {
			playerId: string;
			fullName: string;
			position: Position;
			jerseyNumber: number | null;
		} | null;
	}[];
};

function overallOf(values: RatingValues): number | null {
	const complete = RATING_ATTRIBUTE_KEYS.every(
		(attribute) => values[attribute] !== undefined
	);
	return complete ? overallRating(values) : null;
}

function positionValuesFor(
	position: Position,
	values: Record<string, number>
): Record<string, number> {
	const allowed = positionRatingAttributes(position);
	return Object.fromEntries(
		allowed
			.filter((attribute) => values[attribute.key] !== undefined)
			.map((attribute) => [attribute.key, values[attribute.key]])
	);
}

/**
 * La forme récente ne garde que les cinq derniers matchs évalués, du plus
 * récent au plus ancien. Un match partiellement évalué pèse autant qu'un
 * match complet : sa moyenne porte sur les critères réellement observés.
 */
function formFor(playerId: string, position: Position): RatingsForm {
	const allowed = new Set(
		gameRatingAttributes(position).map((attribute) => attribute.key)
	);
	const rows = listPlayerGameRatings(playerId)
		.filter((row) => allowed.has(row.attribute as GameRatingAttribute))
		.sort((left, right) => {
			if (left.gameDate !== right.gameDate) {
				return left.gameDate < right.gameDate ? 1 : -1;
			}
			if (left.startTime !== right.startTime) {
				return left.startTime < right.startTime ? 1 : -1;
			}
			return left.gameId < right.gameId ? 1 : left.gameId > right.gameId ? -1 : 0;
		});

	const games = new Map<string, number[]>();
	for (const row of rows) {
		const values = games.get(row.gameId) ?? [];
		values.push(row.value);
		games.set(row.gameId, values);
	}
	const means = [...games.values()]
		.slice(0, RATING_FORM_WINDOW)
		.map((values) => meanRating(values))
		.filter((value): value is number => value !== null);
	return {
		average: meanRating(means),
		games: means.length
	};
}

export function getRatings(actor: Actor, playerId: string): RatingsView {
	requirePermission(actor, 'editRatings');
	const player = getPlayer(actor, playerId);

	const rows = listRatings(playerId);
	const values: RatingValues = {};
	const all: Record<string, number> = {};
	let updatedAt: number | null = null;
	for (const row of rows) {
		all[row.attribute] = row.value;
		if (RATING_ATTRIBUTE_KEYS.includes(row.attribute as RatingAttribute)) {
			values[row.attribute as RatingAttribute] = row.value;
		}
		updatedAt = Math.max(updatedAt ?? 0, row.updatedAt);
	}

	const positionValues = positionValuesFor(player.position, all);
	const allowed = positionRatingAttributes(player.position);

	return {
		playerId,
		values,
		overall: overallOf(values),
		positionValues,
		positionOverall: meanRating(Object.values(positionValues)),
		positionComplete: Object.keys(positionValues).length === allowed.length,
		positionTotal: allowed.length,
		form: formFor(playerId, player.position),
		updatedAt
	};
}

export function setRatings(
	actor: Actor,
	playerId: string,
	input: RatingsInput,
	positionInput: Record<string, unknown> = {}
): RatingsView {
	const user = requirePermission(actor, 'editRatings');
	const player = getPlayer(actor, playerId);
	const values = parseSchema(ratingsInputSchema, input);

	const allowed = positionRatingAttributes(player.position);
	const positionValues: Record<string, number> = {};
	for (const [key, raw] of Object.entries(positionInput)) {
		if (!allowed.some((attribute) => attribute.key === key)) {
			throw new AppError('VALIDATION', {
				details: [{ path: key, code: 'unknown_attribute' }]
			});
		}
		if (raw === undefined || raw === null || raw === '') continue;
		const value = Number(raw);
		if (!isRatingValue(value)) {
			throw new AppError('VALIDATION', {
				details: [{ path: key, code: 'invalid_rating' }]
			});
		}
		positionValues[key] = value;
	}

	upsertRatings(
		playerId,
		{ ...values, ...positionValues },
		clock.nowMs(),
		user.userId
	);
	recordAudit(actor, {
		action: 'ratings.update',
		entityType: 'player',
		entityId: playerId
	});
	regenerateUpcomingGeneratedGames();

	return getRatings(actor, playerId);
}

export function evaluationOverviews(actor: Actor): EvaluationOverview[] {
	requirePermission(actor, 'editRatings');
	const players = listAdminPlayers(actor);
	const rows = listRatingsForPlayers(players.map((player) => player.userId));
	const grouped = new Map<string, Record<string, number>>();
	const updated = new Map<string, number>();
	for (const row of rows) {
		const values = grouped.get(row.playerId) ?? {};
		values[row.attribute] = row.value;
		grouped.set(row.playerId, values);
		updated.set(
			row.playerId,
			Math.max(updated.get(row.playerId) ?? 0, row.updatedAt)
		);
	}

	return players.map((player) => {
		const all = grouped.get(player.userId) ?? {};
		const core: RatingValues = {};
		for (const key of RATING_ATTRIBUTE_KEYS) {
			if (all[key] !== undefined) core[key] = all[key];
		}
		const position = positionValuesFor(player.position, all);
		const overall = overallOf(core);
		const positionCompleted = Object.keys(position).length;
		const positionTotal = positionRatingAttributes(player.position).length;
		return {
			playerId: player.userId,
			fullName: player.fullName,
			position: player.position,
			overall,
			positionCompleted,
			positionTotal,
			complete: overall !== null && positionCompleted === positionTotal,
			updatedAt: updated.get(player.userId) ?? null
		};
	});
}

/**
 * Construit l'évaluation d'un match à partir de l'alignement habillé et des
 * critères autorisés au poste de chaque joueur. Une note enregistrée pour un
 * ancien poste ne compte ni dans les valeurs ni dans les totaux.
 */
function buildAssessmentPlayers(
	game: AssessmentGame,
	rows: readonly GameRatingRow[]
): GameAssessmentPlayer[] {
	const grouped = new Map<
		string,
		Map<string, { value: number; updatedAt: number }>
	>();
	for (const row of rows) {
		const values =
			grouped.get(row.playerId) ?? new Map<string, { value: number; updatedAt: number }>();
		values.set(row.attribute, { value: row.value, updatedAt: row.updatedAt });
		grouped.set(row.playerId, values);
	}

	const players: GameAssessmentPlayer[] = [];
	const seen = new Set<string>();
	for (const slot of game.slots) {
		if (!slot.player || seen.has(slot.player.playerId)) continue;
		seen.add(slot.player.playerId);
		const allowed = gameRatingAttributes(slot.player.position);
		const stored = grouped.get(slot.player.playerId) ?? new Map();
		const values: Partial<Record<GameRatingAttribute, number>> = {};
		let version = 0;
		for (const attribute of allowed) {
			const entry = stored.get(attribute.key);
			if (!entry) continue;
			values[attribute.key] = entry.value;
			version = Math.max(version, entry.updatedAt);
		}
		const rated = Object.keys(values).length;
		players.push({
			playerId: slot.player.playerId,
			fullName: slot.player.fullName,
			position: slot.player.position,
			jerseyNumber: slot.player.jerseyNumber,
			values,
			rated,
			total: allowed.length,
			complete: rated === allowed.length,
			version
		});
	}
	return players;
}

export function getGameAssessment(
	actor: Actor,
	gameId: string
): GameAssessmentView {
	requirePermission(actor, 'editRatings');
	const game = getGame(actor, gameId);
	const players = buildAssessmentPlayers(game, listGameRatings(gameId));

	return {
		gameId,
		gameDate: game.gameDate,
		startTime: game.startTime,
		location: game.location,
		status: game.status,
		canRate: isGamePlayable(game),
		players,
		ratedPlayers: players.filter((player) => player.complete).length,
		totalPlayers: players.length
	};
}

export function saveGameAssessment(
	actor: Actor,
	gameId: string,
	playerId: string,
	input: Record<string, unknown>
): GameAssessmentView {
	const user = requirePermission(actor, 'editRatings');
	const game = getGame(actor, gameId);
	if (game.status === 'cancelled') {
		throw new AppError('CONFLICT', { key: 'rating.gameCancelled' });
	}
	if (!game.generated) {
		throw new AppError('CONFLICT', { key: 'rating.gameNotGenerated' });
	}
	if (!isGamePlayable(game)) {
		throw new AppError('CONFLICT', { key: 'rating.gameNotPlayed' });
	}
	const slot = game.slots.find((entry) => entry.player?.playerId === playerId);
	if (!slot?.player) {
		throw new AppError('VALIDATION', {
			key: 'rating.playerNotInGame'
		});
	}

	const allowed = gameRatingAttributes(slot.player.position);
	const allowedKeys = new Set<string>(allowed.map((attribute) => attribute.key));
	const values: Record<string, number> = {};
	for (const [key, raw] of Object.entries(input)) {
		if (!isGameRatingAttribute(slot.player.position, key)) {
			throw new AppError('VALIDATION', {
				details: [{ path: key, code: 'unknown_attribute' }]
			});
		}
		if (raw === undefined || raw === null || raw === '') continue;
		const value = Number(raw);
		if (!isRatingValue(value)) {
			throw new AppError('VALIDATION', {
				details: [{ path: key, code: 'invalid_rating' }]
			});
		}
		values[key] = value;
	}

	const dressedPlayerIds = [
		...new Set(
			game.slots
				.map((entry) => entry.player?.playerId)
				.filter((id): id is string => Boolean(id))
		)
	];
	const previousAttributes = listGameRatings(gameId).filter(
		(row) => row.playerId === playerId && allowedKeys.has(row.attribute)
	).length;

	replaceGameRatings(
		gameId,
		playerId,
		values,
		clock.nowMs(),
		user.userId,
		dressedPlayerIds
	);
	// L'audit garde le nombre de critères avant et après, jamais les notes :
	// une évaluation reste privée même pour les administrateurs.
	recordAudit(actor, {
		action: 'ratings.game',
		entityType: 'game',
		entityId: gameId,
		metadata: {
			playerId,
			attributes: Object.keys(values),
			previousAttributes,
			cleared: previousAttributes > 0 && Object.keys(values).length === 0
		}
	});

	return getGameAssessment(actor, gameId);
}

export type PlayedGameAssessment = {
	gameId: string;
	gameDate: string;
	startTime: string;
	location: string;
	status: string;
	players: number;
	rated: number;
	complete: boolean;
};

/**
 * Les matchs déjà joués, avec le nombre de joueurs alignés et complètement
 * évalués. Un match sans note reste visible : c'est justement celui à remplir.
 */
export function playedGamesForAssessment(
	actor: Actor,
	limit = 8
): PlayedGameAssessment[] {
	requirePermission(actor, 'editRatings');
	const games: PlayedGameAssessment[] = [];
	for (const summary of [...listSchedule(actor)].reverse()) {
		const game = getGame(actor, summary.id);
		if (!isGamePlayable(game)) continue;
		const players = buildAssessmentPlayers(game, listGameRatings(game.id));
		if (players.length === 0) continue;
		const rated = players.filter((player) => player.complete).length;
		games.push({
			gameId: game.id,
			gameDate: game.gameDate,
			startTime: game.startTime,
			location: game.location,
			status: game.status,
			players: players.length,
			rated,
			complete: rated === players.length
		});
		if (games.length === limit) break;
	}
	return games;
}

export type { GameRatingAttribute, PositionRatingAttribute };
