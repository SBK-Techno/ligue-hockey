import type { Position } from '#config/positions.ts';
import { gameWarningsInOrder, type GameWarning } from '#config/game-warnings.ts';
import { TEAMS, type Team } from '#config/teams.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
import { playerCandidatesByIds } from '#lib/domain/players/candidates.ts';
import { listGameRatingPlayerIds } from '#lib/domain/ratings/queries.ts';
import { overallsForPlayers } from '#lib/domain/ratings/overall.ts';
import { rulesForGeneration } from '#lib/domain/rules/generation.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import type { SettingsValues } from '#config/settings-registry.ts';
import {
	balanceView,
	bestSwap,
	fillSuggestions,
	violationsFor,
	type BalanceView,
	type Placement
} from '#lib/domain/teams/balance.ts';
import type { GeneratorPlayer } from '#lib/domain/teams/generator.ts';
import { AppError } from '#lib/shared/errors.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { findGame, listSlotAssignments, saveAssignments, type SlotAssignment } from './queries.ts';
import { isLineupEditable } from './playability.ts';
import { lineupPool, type LineupPool } from './pool.ts';
import { getGame, type GameView } from './service.ts';
import type { GenerationSnapshot } from './validators.ts';

export type LineupIntelligence = {
	complete: boolean;
	openSlots: number;
	placed: number;
	skillDiff: number | null;
	ageDiff: number;
	sizeDiff: number;
	averages: Record<Team, number | null>;
	sizes: Record<Team, number>;
	swap: {
		playerAId: string;
		playerBId: string;
		nameA: string;
		nameB: string;
		position: Position;
		skillDiffBefore: number;
		skillDiffAfter: number;
		ageDiffBefore: number;
		ageDiffAfter: number;
	} | null;
	fills: {
		count: number;
		names: string[];
	};
	benchNames: string[];
	unratedNames: string[];
};

export type FillResult = {
	filled: number;
	intelligence: LineupIntelligence;
};

function byTeam<T>(value: (team: Team) => T): Record<Team, T> {
	return Object.fromEntries(
		TEAMS.map((team) => [team.key, value(team.key)])
	) as Record<Team, T>;
}

function emptyIntelligence(): LineupIntelligence {
	return {
		complete: false,
		openSlots: 0,
		placed: 0,
		skillDiff: null,
		ageDiff: 0,
		sizeDiff: 0,
		averages: byTeam(() => null),
		sizes: byTeam(() => 0),
		swap: null,
		fills: { count: 0, names: [] },
		benchNames: [],
		unratedNames: []
	};
}

function average(view: BalanceView, team: Team): number | null {
	const totals = view.totals[team];
	if (totals.count === 0) return null;
	return Number(totals.skillAverage.toFixed(2));
}

function ratedPlayers(pool: LineupPool) {
	const placed = [...pool.players.values()].filter((member) => member.placed);
	return [...placed, ...pool.available].map((member) => ({
		id: member.playerId,
		position: member.position,
		age: member.age,
		overall: member.overall,
		kind: member.kind,
		eligiblePositions: member.eligiblePositions
	}));
}

function intelligenceFrom(pool: LineupPool): LineupIntelligence {
	const fillPool = ratedPlayers(pool);
	const players: GeneratorPlayer[] = fillPool.map((player) => ({
		id: player.id,
		position: player.position,
		age: player.age,
		overall: player.overall,
		kind: player.kind
	}));
	const rules = rulesForGeneration();
	const view = balanceView(pool.placed, players);
	const swap = bestSwap({
		placements: pool.placed,
		players,
		rules,
		maxAgeSpread: pool.settings['teams.maxAgeSpread']
	});
	const fills = fillSuggestions({
		openSlots: pool.openSlots,
		placements: pool.placed,
		pool: fillPool,
		rules
	});

	return {
		complete: view.complete,
		openSlots: pool.openSlots.length,
		placed: pool.placed.length,
		skillDiff: view.skillDiff,
		ageDiff: view.ageDiff,
		sizeDiff: view.sizeDiff,
		averages: byTeam((team) => average(view, team)),
		sizes: byTeam((team) => view.totals[team].count),
		swap: swap
			? {
					playerAId: swap.playerAId,
					playerBId: swap.playerBId,
					nameA: pool.names.get(swap.playerAId) ?? swap.playerAId,
					nameB: pool.names.get(swap.playerBId) ?? swap.playerBId,
					position: swap.position,
					skillDiffBefore: swap.skillDiffBefore,
					skillDiffAfter: swap.skillDiffAfter,
					ageDiffBefore: swap.ageDiffBefore,
					ageDiffAfter: swap.ageDiffAfter
				}
			: null,
		fills: {
			count: fills.length,
			names: fills.map((fill) => pool.names.get(fill.playerId) ?? fill.playerId)
		},
		benchNames: pool.bench.map((entry) => pool.names.get(entry.playerId) ?? entry.playerId),
		unratedNames: pool.unrated
	};
}

/**
 * Intelligence de l'alignement. Les moyennes dérivent des notes : elles ne
 * sortent du service que pour un acteur autorisé à gérer les matchs, jamais
 * parce que la page est sous /admin.
 */
export function lineupIntelligence(actor: Actor, game: GameView): LineupIntelligence {
	requirePermission(actor, 'manageGames');
	if (!game.generated) return emptyIntelligence();
	const row = findGame(game.id);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	return intelligenceFrom(lineupPool(row, game.slots));
}

function editableGame(actor: Actor, gameId: string): { game: GameView; pool: LineupPool } {
	requirePermission(actor, 'manageGames');
	const game = getGame(actor, gameId);
	if (!isLineupEditable(game)) {
		throw new AppError('CONFLICT', { key: 'games.lineupLocked' });
	}
	if (!game.generated) {
		throw new AppError('CONFLICT', { key: 'rating.gameNotGenerated' });
	}
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	return { game, pool: lineupPool(row, game.slots) };
}

function placementsOf(assignments: readonly SlotAssignment[]): Placement[] {
	return assignments.map((assignment) => ({
		playerId: assignment.playerId,
		team: assignment.team,
		position: assignment.position
	}));
}

function candidateKey(assignments: readonly SlotAssignment[]): string {
	return [...assignments]
		.sort(
			(a, b) =>
				a.team.localeCompare(b.team) ||
				a.position.localeCompare(b.position) ||
				a.slotIndex - b.slotIndex
		)
		.map(
			(assignment) =>
				`${assignment.team}:${assignment.position}:${assignment.slotIndex}:${assignment.playerId}`
		)
		.join('|');
}

function slotKey(slot: {
	team: Team;
	position: Position;
	slotIndex: number;
}): string {
	return `${slot.team}:${slot.position}:${slot.slotIndex}`;
}

function validatedOpenSlots(
	gameId: string,
	assignments: readonly SlotAssignment[]
): number {
	const slots = listSlotAssignments(gameId);
	const known = new Set(
		slots.map((slot) =>
			slotKey({ team: slot.team, position: slot.position, slotIndex: slot.slotIndex })
		)
	);
	const written = new Set<string>();
	const players = new Set<string>();

	for (const assignment of assignments) {
		const key = slotKey(assignment);
		if (!known.has(key) || written.has(key)) {
			throw new AppError('INTERNAL', {
				message: `Invalid alignment slot: ${key}`
			});
		}
		if (players.has(assignment.playerId)) {
			throw new AppError('INTERNAL', {
				message: `Duplicate player in alignment: ${assignment.playerId}`
			});
		}
		written.add(key);
		players.add(assignment.playerId);
	}

	return known.size - written.size;
}

function limitExceeded(view: BalanceView, settings: SettingsValues): boolean {
	const skill = settings['teams.maxSkillSpread'];
	const age = settings['teams.maxAgeSpread'];
	const size = settings['teams.maxSizeSpread'];
	return (
		(skill > 0 && view.skillDiff !== null && view.skillDiff > skill) ||
		(age > 0 && view.ageDiff > age) ||
		(size > 0 && view.sizeDiff > size)
	);
}

/**
 * Écrit un alignement modifié et recalcule son état réel : écarts, règles,
 * plafonds et places ouvertes. Les places ouvertes viennent du jeu de places
 * du match et des affectations écrites, jamais d'un compte fourni. L'audit
 * est écrit dans la même transaction que les places.
 */
function saveAlignment(
	actor: Actor,
	gameId: string,
	assignments: SlotAssignment[],
	bench: readonly { playerId: string; position: Position; kind: 'regular' | 'sub' }[],
	action: string,
	metadata: Record<string, unknown>
): void {
	const openSlots = validatedOpenSlots(gameId, assignments);
	const ids = assignments.map((assignment) => assignment.playerId);
	const dressed = new Set(ids);
	const removedRatedPlayerIds = listGameRatingPlayerIds(gameId).filter(
		(playerId) => !dressed.has(playerId)
	);
	const details = playerCandidatesByIds(ids);
	const overalls = overallsForPlayers(ids);
	const kindById = new Map(
		assignments.map((assignment) => [assignment.playerId, assignment.kind])
	);
	const players: GeneratorPlayer[] = details
		.filter((player) => overalls.has(player.userId))
		.map((player) => ({
			id: player.userId,
			position: player.position,
			age: player.age,
			overall: overalls.get(player.userId)!,
			kind: kindById.get(player.userId) ?? 'regular'
		}));
	const placements = placementsOf(assignments);
	const view = balanceView(placements, players);
	const violations = violationsFor(placements, rulesForGeneration());
	const strict = violations.filter((violation) => violation.strict).length;
	const soft = violations.length - strict;
	const settings = getSettings();

	const warnings: GameWarning[] = [];
	if (openSlots > 0) warnings.push('unfilled-slots');
	if (strict > 0) warnings.push('rule-conflict');
	if (soft > 0) warnings.push('rule-preference');
	if (limitExceeded(view, settings)) warnings.push('rule-limit');

	const seen = new Set<string>();
	const benchEntries = bench.filter((entry) => {
		if (seen.has(entry.playerId)) return false;
		seen.add(entry.playerId);
		return true;
	});

	const generatedAt = clock.nowMs();
	const snapshot: GenerationSnapshot = {
		skillDiff: view.skillDiff,
		ageDiff: view.ageDiff,
		sizeDiff: view.sizeDiff,
		warnings: gameWarningsInOrder(warnings),
		ruleViolations: violations,
		bench: benchEntries.map((entry) => ({
			playerId: entry.playerId,
			position: entry.position,
			kind: entry.kind
		})),
		candidateKey: candidateKey(assignments),
		generatedAt
	};

	saveAssignments(
		gameId,
		assignments,
		generatedAt,
		JSON.stringify(snapshot),
		generatedAt,
		{
			removedRatedPlayerIds,
			audits: [
				auditEntry(actor, {
					action,
					entityType: 'game',
					entityId: gameId,
					metadata
				}),
				...(removedRatedPlayerIds.length > 0
					? [
							auditEntry(actor, {
								action: 'ratings.game_removed',
								entityType: 'game',
								entityId: gameId,
								metadata: { playerIds: removedRatedPlayerIds }
							})
						]
					: [])
			]
		}
	);
}

export function applyBestSwap(actor: Actor, gameId: string): LineupIntelligence {
	const { game, pool } = editableGame(actor, gameId);
	const intelligence = intelligenceFrom(pool);
	if (!intelligence.swap) {
		throw new AppError('CONFLICT', { key: 'games.noBetterSwap' });
	}

	const first = game.slots.find(
		(slot) => slot.player?.playerId === intelligence.swap!.playerAId
	);
	const second = game.slots.find(
		(slot) => slot.player?.playerId === intelligence.swap!.playerBId
	);
	if (!first?.player || !second?.player) {
		throw new AppError('CONFLICT', { key: 'games.noBetterSwap' });
	}

	const assignments: SlotAssignment[] = game.slots
		.filter((slot) => slot.player)
		.map((slot) => {
			const source =
				slot.player!.playerId === first.player!.playerId
					? second.player!
					: slot.player!.playerId === second.player!.playerId
						? first.player!
						: slot.player!;
			return {
				team: slot.team,
				position: slot.position,
				slotIndex: slot.slotIndex,
				playerId: source.playerId,
				kind: source.kind
			};
		});

	saveAlignment(actor, gameId, assignments, pool.bench, 'game.swap', {
		playerAId: intelligence.swap.playerAId,
		playerBId: intelligence.swap.playerBId
	});
	return lineupIntelligence(actor, getGame(actor, gameId));
}

export function fillOpenSlots(actor: Actor, gameId: string): FillResult {
	const { game, pool } = editableGame(actor, gameId);
	const suggestions = fillSuggestions({
		openSlots: pool.openSlots,
		placements: pool.placed,
		pool: ratedPlayers(pool),
		rules: rulesForGeneration()
	});
	if (suggestions.length === 0) {
		throw new AppError('CONFLICT', { key: 'games.noOneToFill' });
	}

	const filled = new Set(suggestions.map((suggestion) => suggestion.playerId));
	const assignments: SlotAssignment[] = game.slots
		.filter((slot) => slot.player)
		.map((slot) => ({
			team: slot.team,
			position: slot.position,
			slotIndex: slot.slotIndex,
			playerId: slot.player!.playerId,
			kind: slot.player!.kind
		}));

	for (const suggestion of suggestions) {
		assignments.push({
			team: suggestion.slot.team,
			position: suggestion.slot.position,
			slotIndex: suggestion.slot.index,
			playerId: suggestion.playerId,
			kind: pool.kindOf.get(suggestion.playerId) ?? 'regular'
		});
	}

	saveAlignment(
		actor,
		gameId,
		assignments,
		pool.bench.filter((entry) => !filled.has(entry.playerId)),
		'game.fill',
		{
			count: suggestions.length,
			players: suggestions.map((suggestion) => suggestion.playerId)
		}
	);

	return {
		filled: suggestions.length,
		intelligence: lineupIntelligence(actor, getGame(actor, gameId))
	};
}
