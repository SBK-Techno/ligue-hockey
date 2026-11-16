import type { Position } from '#config/positions.ts';
import { TEAMS, type Team } from '#config/teams.ts';
import {
	pairViolations,
	type GeneratorPlayer,
	type GeneratorRule,
	type GeneratorViolation
} from './generator.ts';

export type Placement = {
	playerId: string;
	team: Team;
	position: Position;
};

export type OpenSlot = {
	team: Team;
	position: Position;
	index: number;
};

export type TeamTotals = {
	count: number;
	skill: number;
	age: number;
	skillAverage: number;
};

export type BalanceView = {
	skillDiff: number;
	ageDiff: number;
	sizeDiff: number;
	totals: Record<Team, TeamTotals>;
};

export type SwapSuggestion = {
	playerAId: string;
	playerBId: string;
	teamA: Team;
	teamB: Team;
	position: Position;
	skillDiffBefore: number;
	skillDiffAfter: number;
	ageDiffBefore: number;
	ageDiffAfter: number;
};

export type FillSuggestion = {
	slot: OpenSlot;
	playerId: string;
};

const [TEAM_A, TEAM_B] = [TEAMS[0].key, TEAMS[1].key] as const;

/** Un écart plus petit que ce seuil ne vaut pas un changement d'alignement. */
export const MIN_BALANCE_GAIN = 0.05;

function zeroTotals(): Record<Team, TeamTotals> {
	return {
		[TEAM_A]: { count: 0, skill: 0, age: 0, skillAverage: 0 },
		[TEAM_B]: { count: 0, skill: 0, age: 0, skillAverage: 0 }
	};
}

/**
 * Mesure un alignement avec les mêmes définitions que le générateur :
 * écart de notes moyennes, âge cumulé, taille des équipes.
 */
export function balanceView(
	placements: readonly Placement[],
	players: readonly GeneratorPlayer[]
): BalanceView {
	const byId = new Map(players.map((player) => [player.id, player]));
	const totals = zeroTotals();

	for (const placement of placements) {
		const player = byId.get(placement.playerId);
		if (!player) continue;
		const team = totals[placement.team];
		team.count += 1;
		team.skill += player.overall;
		team.age += player.age;
	}

	for (const team of TEAMS) {
		const entry = totals[team.key];
		entry.skillAverage = entry.count === 0 ? 0 : entry.skill / entry.count;
	}

	const skillDiff =
		totals[TEAM_A].count === 0 || totals[TEAM_B].count === 0
			? 0
			: Math.abs(totals[TEAM_A].skillAverage - totals[TEAM_B].skillAverage);

	return {
		skillDiff: Number(skillDiff.toFixed(3)),
		ageDiff: Number(Math.abs(totals[TEAM_A].age - totals[TEAM_B].age).toFixed(2)),
		sizeDiff: Math.abs(totals[TEAM_A].count - totals[TEAM_B].count),
		totals
	};
}

function teamOf(placements: readonly Placement[]): Map<string, Team> {
	return new Map(placements.map((placement) => [placement.playerId, placement.team]));
}

/**
 * Le meilleur échange possible: même poste, équipes opposées, aucune règle
 * brisée, et un écart de notes qui diminue vraiment. Le résultat est stable
 * pour que deux appels donnent la même suggestion.
 */
export function bestSwap(input: {
	placements: readonly Placement[];
	players: readonly GeneratorPlayer[];
	rules: readonly GeneratorRule[];
	minGain?: number;
}): SwapSuggestion | null {
	const players = new Map(input.players.map((player) => [player.id, player]));
	const placed = [...input.placements]
		.filter((placement) => players.has(placement.playerId))
		.sort((a, b) => a.playerId.localeCompare(b.playerId));
	const current = balanceView(placed, input.players);
	const currentViolations = pairViolations(teamOf(placed), input.rules).length;
	const minGain = input.minGain ?? MIN_BALANCE_GAIN;

	let best: SwapSuggestion | null = null;
	let bestViolations = currentViolations;

	for (const a of placed) {
		for (const b of placed) {
			if (a.team === b.team) continue;
			if (a.position !== b.position) continue;
			if (a.team !== TEAM_A) continue;

			const swapped = placed.map((placement) =>
				placement.playerId === a.playerId
					? { ...placement, team: b.team }
					: placement.playerId === b.playerId
						? { ...placement, team: a.team }
						: placement
			);
			const view = balanceView(swapped, input.players);
			if (view.skillDiff >= current.skillDiff - minGain) continue;

			const violations = pairViolations(teamOf(swapped), input.rules).length;
			if (violations > currentViolations) continue;

			const candidate: SwapSuggestion = {
				playerAId: a.playerId,
				playerBId: b.playerId,
				teamA: a.team,
				teamB: b.team,
				position: a.position,
				skillDiffBefore: current.skillDiff,
				skillDiffAfter: view.skillDiff,
				ageDiffBefore: current.ageDiff,
				ageDiffAfter: view.ageDiff
			};

			if (
				best === null ||
				violations < bestViolations ||
				(violations === bestViolations &&
					(candidate.skillDiffAfter < best.skillDiffAfter ||
						(candidate.skillDiffAfter === best.skillDiffAfter &&
							(candidate.ageDiffAfter < best.ageDiffAfter ||
								(candidate.ageDiffAfter === best.ageDiffAfter &&
									`${candidate.playerAId}:${candidate.playerBId}` <
										`${best.playerAId}:${best.playerBId}`)))))
			) {
				best = candidate;
				bestViolations = violations;
			}
		}
	}

	return best;
}

/**
 * Remplit les places ouvertes avec les joueurs disponibles du poste, en
 * choisissant à chaque fois celui qui rapproche le plus les deux équipes.
 */
export function fillSuggestions(input: {
	openSlots: readonly OpenSlot[];
	placements: readonly Placement[];
	/** Tous les joueurs du bassin, alignés ou non. */
	pool: readonly GeneratorPlayer[];
	rules: readonly GeneratorRule[];
}): FillSuggestion[] {
	const placedIds = new Set(input.placements.map((placement) => placement.playerId));
	const available = [...input.pool]
		.filter((player) => !placedIds.has(player.id))
		.sort((a, b) => a.id.localeCompare(b.id));
	const used = new Set<string>();
	const result: FillSuggestion[] = [];
	let placements = [...input.placements];

	const slots = [...input.openSlots].sort(
		(a, b) =>
			a.team.localeCompare(b.team) ||
			a.position.localeCompare(b.position) ||
			a.index - b.index
	);

	for (const slot of slots) {
		let bestPlayer: GeneratorPlayer | null = null;
		let bestSkill = Number.POSITIVE_INFINITY;
		let bestAge = Number.POSITIVE_INFINITY;

		for (const player of available) {
			if (used.has(player.id)) continue;
			if (player.position !== slot.position) continue;

			const view = balanceView(
				[...placements, { playerId: player.id, team: slot.team, position: slot.position }],
				input.pool
			);
			const violations = pairViolations(
				teamOf([
					...placements,
					{ playerId: player.id, team: slot.team, position: slot.position }
				]),
				input.rules
			).length;
			if (violations > 0) continue;

			if (
				view.skillDiff < bestSkill ||
				(view.skillDiff === bestSkill && view.ageDiff < bestAge)
			) {
				bestPlayer = player;
				bestSkill = view.skillDiff;
				bestAge = view.ageDiff;
			}
		}

		if (!bestPlayer) continue;
		used.add(bestPlayer.id);
		result.push({ slot, playerId: bestPlayer.id });
		placements = [
			...placements,
			{ playerId: bestPlayer.id, team: slot.team, position: slot.position }
		];
	}

	return result;
}

export function violationsFor(
	placements: readonly Placement[],
	rules: readonly GeneratorRule[]
): GeneratorViolation[] {
	return pairViolations(teamOf(placements), rules);
}
