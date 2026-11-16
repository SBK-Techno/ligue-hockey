import {
	RATING_ATTRIBUTE_KEYS,
	RATING_SCALE,
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
import { branding } from '#lib/generated/branding.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { getGame, listSchedule } from '#lib/domain/games/service.ts';
import { regenerateUpcomingGeneratedGames } from '#lib/domain/games/upcoming.ts';
import {
	listAdminPlayers,
	getPlayer
} from '#lib/domain/players/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { clock, todayInZone } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import {
	listGameRatings,
	listPlayerGameRatings,
	listRatings,
	listRatingsForPlayers,
	listRecentAssessments,
	replaceGameRatings,
	upsertRatings,
	type RecentAssessmentRow
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
	updatedAt: number | null;
};

export type GameAssessmentPlayer = {
	playerId: string;
	fullName: string;
	position: Position;
	jerseyNumber: number | null;
	values: Record<string, number>;
	rated: number;
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

function formFor(playerId: string): RatingsForm {
	const rows = listPlayerGameRatings(playerId);
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
		form: formFor(playerId),
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
		return {
			playerId: player.userId,
			fullName: player.fullName,
			position: player.position,
			overall: overallOf(core),
			positionCompleted: Object.keys(position).length,
			positionTotal: positionRatingAttributes(player.position).length,
			updatedAt: updated.get(player.userId) ?? null
		};
	});
}

function canRateGame(game: {
	status: string;
	gameDate: string;
}): boolean {
	const today = todayInZone(branding.timezone, clock.nowMs());
	return game.status === 'completed' || game.gameDate <= today;
}

export function getGameAssessment(
	actor: Actor,
	gameId: string
): GameAssessmentView {
	requirePermission(actor, 'editRatings');
	const game = getGame(actor, gameId);
	const rows = listGameRatings(gameId);
	const grouped = new Map<string, Record<string, number>>();
	for (const row of rows) {
		const values = grouped.get(row.playerId) ?? {};
		values[row.attribute] = row.value;
		grouped.set(row.playerId, values);
	}

	const players: GameAssessmentPlayer[] = [];
	const seen = new Set<string>();
	for (const slot of game.slots) {
		if (!slot.player || seen.has(slot.player.playerId)) continue;
		seen.add(slot.player.playerId);
		const values = grouped.get(slot.player.playerId) ?? {};
		players.push({
			playerId: slot.player.playerId,
			fullName: slot.player.fullName,
			position: slot.player.position,
			jerseyNumber: slot.player.jerseyNumber,
			values,
			rated: Object.keys(values).length
		});
	}

	return {
		gameId,
		gameDate: game.gameDate,
		startTime: game.startTime,
		location: game.location,
		status: game.status,
		canRate: canRateGame(game),
		players,
		ratedPlayers: players.filter((player) => player.rated > 0).length
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
	if (!canRateGame(game)) {
		throw new AppError('CONFLICT', { key: 'rating.gameNotPlayed' });
	}
	const slot = game.slots.find((entry) => entry.player?.playerId === playerId);
	if (!slot?.player) {
		throw new AppError('VALIDATION', {
			key: 'rating.playerNotInGame'
		});
	}
	if (!game.generated) {
		throw new AppError('CONFLICT', { key: 'rating.gameNotGenerated' });
	}

	const allowed = gameRatingAttributes(slot.player.position);
	const values: Record<string, number> = {};
	for (const [key, raw] of Object.entries(input)) {
		if (raw === undefined || raw === null || raw === '') continue;
		if (!isGameRatingAttribute(slot.player.position, key)) {
			throw new AppError('VALIDATION', {
				details: [{ path: key, code: 'unknown_attribute' }]
			});
		}
		const value = Number(raw);
		if (!isRatingValue(value)) {
			throw new AppError('VALIDATION', {
				details: [{ path: key, code: 'invalid_rating' }]
			});
		}
		values[key] = value;
	}
	for (const attribute of allowed) {
		const value = values[attribute.key];
		if (value !== undefined && (value < RATING_SCALE.min || value > RATING_SCALE.max)) {
			throw new AppError('VALIDATION', {
				details: [{ path: attribute.key, code: 'invalid_rating' }]
			});
		}
	}

	replaceGameRatings(gameId, playerId, values, clock.nowMs(), user.userId);
	recordAudit(actor, {
		action: 'ratings.game',
		entityType: 'game',
		entityId: gameId,
		metadata: { playerId, attributes: Object.keys(values) }
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
};

/**
 * Les matchs déjà joués, avec le nombre de joueurs alignés et évalués.
 * Un match sans note reste visible : c'est justement celui à remplir.
 */
export function playedGamesForAssessment(
	actor: Actor,
	limit = 8
): PlayedGameAssessment[] {
	requirePermission(actor, 'editRatings');
	const today = todayInZone(branding.timezone, clock.nowMs());
	const counts = new Map(
		listRecentAssessments(50).map((row) => [row.gameId, row.players])
	);
	return listSchedule(actor)
		.filter((game) => game.status === 'completed' || game.gameDate <= today)
		.slice(-limit)
		.reverse()
		.map((summary) => {
			const game = getGame(actor, summary.id);
			const players = new Set(
				game.slots
					.map((slot) => slot.player?.playerId)
					.filter((playerId): playerId is string => Boolean(playerId))
			);
			return {
				gameId: game.id,
				gameDate: game.gameDate,
				startTime: game.startTime,
				location: game.location,
				status: game.status,
				players: players.size,
				rated: counts.get(game.id) ?? 0
			};
		});
}

export function recentAssessmentGames(actor: Actor): RecentAssessmentRow[] {
	requirePermission(actor, 'editRatings');
	return listRecentAssessments(10);
}

export type { GameRatingAttribute, PositionRatingAttribute };
