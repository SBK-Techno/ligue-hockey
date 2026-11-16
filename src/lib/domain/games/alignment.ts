import type { Position } from '#config/positions.ts';
import type { Team } from '#config/teams.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { playerCandidatesByIds } from '#lib/domain/players/candidates.ts';
import {
	overallsForPlayers,
	requireCompleteRatings
} from '#lib/domain/ratings/overall.ts';
import { rulesForGeneration } from '#lib/domain/rules/generation.ts';
import {
	balanceView,
	bestSwap,
	fillSuggestions,
	violationsFor,
	type Placement
} from '#lib/domain/teams/balance.ts';
import type { GeneratorPlayer } from '#lib/domain/teams/generator.ts';
import { AppError } from '#lib/shared/errors.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { findGame, saveAssignments, type SlotAssignment } from './queries.ts';
import { getGame, type GameView } from './service.ts';

export type LineupIntelligence = {
	generated: boolean;
	openSlots: number;
	skillDiff: number;
	ageDiff: number;
	sizeDiff: number;
	averageWhite: number;
	averageBlack: number;
	swap: {
		playerAId: string;
		playerBId: string;
		nameA: string;
		nameB: string;
		position: Position;
		skillDiffBefore: number;
		skillDiffAfter: number;
	} | null;
	fills: {
		count: number;
		names: string[];
	};
	benchNames: string[];
};

function emptyIntelligence(): LineupIntelligence {
	return {
		generated: false,
		openSlots: 0,
		skillDiff: 0,
		ageDiff: 0,
		sizeDiff: 0,
		averageWhite: 0,
		averageBlack: 0,
		swap: null,
		fills: { count: 0, names: [] },
		benchNames: []
	};
}

type LineupContext = {
	placements: Placement[];
	openSlots: { team: Team; position: Position; index: number }[];
	players: GeneratorPlayer[];
	names: Map<string, string>;
	bench: { playerId: string; position: Position; kind: 'regular' | 'sub' }[];
};

function lineupContext(game: GameView): LineupContext {
	const bench = game.generation?.bench ?? [];
	const placedIds = game.slots
		.filter((slot) => slot.player)
		.map((slot) => slot.player!.playerId);
	const ids = [...new Set([...placedIds, ...bench.map((entry) => entry.playerId)])];
	const details = playerCandidatesByIds(ids);
	const byId = new Map(details.map((player) => [player.userId, player]));
	const names = new Map(details.map((player) => [player.userId, player.fullName]));
	const required = requireCompleteRatings(placedIds);
	const optional = overallsForPlayers(bench.map((entry) => entry.playerId));
	const kindById = new Map<string, 'regular' | 'sub'>([
		...game.slots
			.filter((slot) => slot.player)
			.map((slot) => [slot.player!.playerId, slot.player!.kind] as const),
		...bench.map((entry) => [entry.playerId, entry.kind] as const)
	]);

	const players: GeneratorPlayer[] = ids
		.map((id) => {
			const detail = byId.get(id);
			const overall = required.get(id) ?? optional.get(id);
			if (!detail || overall === undefined) return null;
			return {
				id,
				position: detail.position,
				age: detail.age,
				overall,
				kind: kindById.get(id) ?? 'regular'
			};
		})
		.filter((player): player is GeneratorPlayer => player !== null);

	return {
		placements: game.slots
			.filter((slot) => slot.player)
			.map((slot) => ({
				playerId: slot.player!.playerId,
				team: slot.team,
				position: slot.position
			})),
		openSlots: game.slots
			.filter((slot) => !slot.player)
			.map((slot) => ({
				team: slot.team,
				position: slot.position,
				index: slot.slotIndex
			})),
		players,
		names,
		bench
	};
}

export function lineupIntelligence(game: GameView): LineupIntelligence {
	if (!game.generated) return emptyIntelligence();

	const context = lineupContext(game);
	const rules = rulesForGeneration();
	const view = balanceView(context.placements, context.players);
	const swap = bestSwap({
		placements: context.placements,
		players: context.players,
		rules
	});
	const fills = fillSuggestions({
		openSlots: context.openSlots,
		placements: context.placements,
		pool: context.players,
		rules
	});

	return {
		generated: true,
		openSlots: context.openSlots.length,
		skillDiff: view.skillDiff,
		ageDiff: view.ageDiff,
		sizeDiff: view.sizeDiff,
		averageWhite: Number(view.totals.white.skillAverage.toFixed(2)),
		averageBlack: Number(view.totals.black.skillAverage.toFixed(2)),
		swap: swap
			? {
					playerAId: swap.playerAId,
					playerBId: swap.playerBId,
					nameA: context.names.get(swap.playerAId) ?? swap.playerAId,
					nameB: context.names.get(swap.playerBId) ?? swap.playerBId,
					position: swap.position,
					skillDiffBefore: swap.skillDiffBefore,
					skillDiffAfter: swap.skillDiffAfter
				}
			: null,
		fills: {
			count: fills.length,
			names: fills.map((fill) => context.names.get(fill.playerId) ?? fill.playerId)
		},
		benchNames: context.bench.map(
			(entry) => context.names.get(entry.playerId) ?? entry.playerId
		)
	};
}

function assertEditable(gameId: string): void {
	const row = findGame(gameId);
	if (!row) {
		throw new AppError('NOT_FOUND', { key: 'games.noMatch' });
	}
	if (row.status !== 'scheduled') {
		throw new AppError('CONFLICT', { key: 'admin.gameNotScheduled' });
	}
	if (row.generationJson === null) {
		throw new AppError('CONFLICT', { key: 'rating.gameNotGenerated' });
	}
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

/**
 * Écrit un alignement modifié et recalcule son état réel : écarts, règles et
 * places ouvertes. Le snapshot cesse de décrire la génération passée pour
 * décrire l'alignement qui est réellement publié.
 */
function saveAlignment(
	gameId: string,
	assignments: SlotAssignment[],
	bench: { playerId: string; position: Position; kind: 'regular' | 'sub' }[],
	openSlots: number
): void {
	const ids = assignments.map((assignment) => assignment.playerId);
	const names = playerCandidatesByIds(ids);
	const overalls = requireCompleteRatings(ids);
	const players: GeneratorPlayer[] = names.map((player) => ({
		id: player.userId,
		position: player.position,
		age: player.age,
		overall: overalls.get(player.userId) ?? 0,
		kind: 'regular'
	}));
	const view = balanceView(placementsOf(assignments), players);
	const violations = violationsFor(placementsOf(assignments), rulesForGeneration());
	const warnings: string[] = [];
	if (openSlots > 0) {
		warnings.push('unfilled-slots');
	}
	if (violations.some((violation) => violation.strict)) {
		warnings.push('rule-conflict');
	}
	if (violations.some((violation) => !violation.strict)) {
		warnings.push('rule-preference');
	}

	const generatedAt = clock.nowMs();
	saveAssignments(
		gameId,
		assignments,
		generatedAt,
		JSON.stringify({
			skillDiff: view.skillDiff,
			ageDiff: view.ageDiff,
			sizeDiff: view.sizeDiff,
			warnings,
			ruleViolations: violations,
			bench,
			candidateKey: candidateKey(assignments),
			generatedAt
		}),
		generatedAt
	);
}

export function applyBestSwap(actor: Actor, gameId: string): LineupIntelligence {
	requirePermission(actor, 'manageGames');
	assertEditable(gameId);
	const game = getGame(actor, gameId);
	const intelligence = lineupIntelligence(game);
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

	saveAlignment(
		gameId,
		assignments,
		game.generation?.bench ?? [],
		game.openSlots
	);
	recordAudit(actor, {
		action: 'game.swap',
		entityType: 'game',
		entityId: gameId,
		metadata: {
			playerAId: intelligence.swap.playerAId,
			playerBId: intelligence.swap.playerBId
		}
	});
	return lineupIntelligence(getGame(actor, gameId));
}

export function fillOpenSlots(actor: Actor, gameId: string): LineupIntelligence {
	requirePermission(actor, 'manageGames');
	assertEditable(gameId);
	const game = getGame(actor, gameId);
	const intelligence = lineupIntelligence(game);
	if (intelligence.fills.count === 0) {
		throw new AppError('CONFLICT', { key: 'games.noOneToFill' });
	}

	const context = lineupContext(game);
	const suggestions = fillSuggestions({
		openSlots: context.openSlots,
		placements: context.placements,
		pool: context.players,
		rules: rulesForGeneration()
	});
	const kindById = new Map(context.players.map((player) => [player.id, player.kind]));
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
			kind: kindById.get(suggestion.playerId) ?? 'regular'
		});
	}

	saveAlignment(
		gameId,
		assignments,
		(context.bench ?? []).filter((entry) => !filled.has(entry.playerId)),
		Math.max(0, game.openSlots - suggestions.length)
	);
	recordAudit(actor, {
		action: 'game.fill',
		entityType: 'game',
		entityId: gameId,
		metadata: { players: suggestions.map((suggestion) => suggestion.playerId) }
	});
	return lineupIntelligence(getGame(actor, gameId));
}
