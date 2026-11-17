import { positionRank, type Position } from '#config/positions.ts';
import { slotKey } from '#config/slot.ts';
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
	/** Faux dès qu'une équipe est vide : l'écart de notes n'a alors aucun sens. */
	complete: boolean;
	skillDiff: number | null;
	ageDiff: number;
	sizeDiff: number;
	totals: Record<Team, TeamTotals>;
};

export type ViolationCounts = {
	strict: number;
	soft: number;
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

/** Le bassin de comblement : la position native plus les postes réclamés. */
export type FillCandidate = GeneratorPlayer & {
	eligiblePositions?: readonly Position[];
};

const [TEAM_A, TEAM_B] = [TEAMS[0].key, TEAMS[1].key] as const;

/** Un écart plus petit que ce seuil ne vaut pas un changement d'alignement. */
export const MIN_BALANCE_GAIN = 0.05;

function zeroTotals(): Record<Team, TeamTotals> {
	return Object.fromEntries(
		TEAMS.map((team) => [team.key, { count: 0, skill: 0, age: 0, skillAverage: 0 }])
	) as Record<Team, TeamTotals>;
}

function uniquePlacements(placements: readonly Placement[]): Placement[] {
	const seen = new Set<string>();
	const unique: Placement[] = [];
	for (const placement of placements) {
		if (seen.has(placement.playerId)) continue;
		seen.add(placement.playerId);
		unique.push(placement);
	}
	return unique;
}

/**
 * Mesure un alignement avec les mêmes définitions que le générateur :
 * écart de notes moyennes, âge cumulé, taille des équipes. Une équipe vide
 * rend l'écart de notes indéterminé au lieu de le déclarer nul.
 */
export function balanceView(
	placements: readonly Placement[],
	players: readonly GeneratorPlayer[]
): BalanceView {
	const byId = new Map(players.map((player) => [player.id, player]));
	const totals = zeroTotals();

	for (const placement of uniquePlacements(placements)) {
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

	const complete = totals[TEAM_A].count > 0 && totals[TEAM_B].count > 0;
	const skillDiff = complete
		? Math.abs(totals[TEAM_A].skillAverage - totals[TEAM_B].skillAverage)
		: null;

	return {
		complete,
		skillDiff: skillDiff === null ? null : Number(skillDiff.toFixed(3)),
		ageDiff: Number(Math.abs(totals[TEAM_A].age - totals[TEAM_B].age).toFixed(2)),
		sizeDiff: Math.abs(totals[TEAM_A].count - totals[TEAM_B].count),
		totals
	};
}

function teamOf(placements: readonly Placement[]): Map<string, Team> {
	return new Map(placements.map((placement) => [placement.playerId, placement.team]));
}

function teamCounts(placements: readonly Placement[]): Record<Team, number> {
	const counts = Object.fromEntries(TEAMS.map((team) => [team.key, 0])) as Record<
		Team,
		number
	>;
	for (const placement of uniquePlacements(placements)) {
		counts[placement.team] += 1;
	}
	return counts;
}

function openSlotKey(slot: OpenSlot): string {
	return slotKey({
		team: slot.team,
		position: slot.position,
		slotIndex: slot.index
	});
}

function uniqueSlots(slots: readonly OpenSlot[]): OpenSlot[] {
	const seen = new Set<string>();
	return slots.filter((slot) => {
		const key = openSlotKey(slot);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Compte séparément les règles strictes et les préférences. */
export function violationCounts(
	placements: readonly Placement[],
	rules: readonly GeneratorRule[]
): ViolationCounts {
	const violations = violationsFor(placements, rules);
	const strict = violations.filter((violation) => violation.strict).length;
	return { strict, soft: violations.length - strict };
}

function skillValue(view: BalanceView): number {
	return view.skillDiff ?? Number.POSITIVE_INFINITY;
}

function compareSwap(
	candidate: {
		counts: ViolationCounts;
		view: BalanceView;
		playerAId: string;
		playerBId: string;
	},
	best: {
		counts: ViolationCounts;
		view: BalanceView;
		playerAId: string;
		playerBId: string;
	}
): number {
	return (
		candidate.counts.strict - best.counts.strict ||
		candidate.counts.soft - best.counts.soft ||
		skillValue(candidate.view) - skillValue(best.view) ||
		candidate.view.ageDiff - best.view.ageDiff ||
		`${candidate.playerAId}:${candidate.playerBId}`.localeCompare(
			`${best.playerAId}:${best.playerBId}`
		)
	);
}

/**
 * Le meilleur échange possible : même poste, équipes opposées, jamais plus de
 * violations strictes. Ensuite seulement viennent les préférences, l'écart de
 * notes puis l'âge. Réparer une règle stricte passe avant tout le reste.
 */
export function bestSwap(input: {
	placements: readonly Placement[];
	players: readonly GeneratorPlayer[];
	rules: readonly GeneratorRule[];
	minGain?: number;
	/** Écart d'âge cumulé maximal accepté quand il se dégrade. 0 = aucun plafond. */
	maxAgeSpread?: number;
}): SwapSuggestion | null {
	const players = new Map(input.players.map((player) => [player.id, player]));
	const placed = uniquePlacements(input.placements)
		.filter((placement) => players.has(placement.playerId))
		.sort((a, b) => a.playerId.localeCompare(b.playerId));
	const current = balanceView(placed, input.players);
	if (!current.complete) return null;
	const currentSkill = current.skillDiff;
	if (currentSkill === null) return null;

	const currentCounts = violationCounts(placed, input.rules);
	const minGain = input.minGain ?? MIN_BALANCE_GAIN;
	const maxAgeSpread = input.maxAgeSpread ?? 0;
	const seenPairs = new Set<string>();

	let best: {
		candidate: SwapSuggestion;
		counts: ViolationCounts;
		view: BalanceView;
		playerAId: string;
		playerBId: string;
	} | null = null;

	for (const a of placed) {
		for (const b of placed) {
			if (a.playerId === b.playerId) continue;
			if (a.team === b.team) continue;
			if (a.position !== b.position) continue;

			const pairKey = [a.playerId, b.playerId].sort().join(':');
			if (seenPairs.has(pairKey)) continue;
			seenPairs.add(pairKey);

			const swapped = placed.map((placement) =>
				placement.playerId === a.playerId
					? { ...placement, team: b.team }
					: placement.playerId === b.playerId
						? { ...placement, team: a.team }
						: placement
			);
			const counts = violationCounts(swapped, input.rules);
			if (counts.strict > currentCounts.strict) continue;

			const view = balanceView(swapped, input.players);
			const strictBetter = counts.strict < currentCounts.strict;
			const softBetter = counts.soft < currentCounts.soft;
			const skillBetter =
				view.skillDiff !== null && view.skillDiff <= currentSkill - minGain;

			if (!strictBetter && !softBetter && !skillBetter) continue;

			// Une règle stricte réparée vaut toujours le coup. Sinon, on refuse
			// d'aggraver un âge cumulé déjà hors du plafond configuré.
			if (
				!strictBetter &&
				maxAgeSpread > 0 &&
				view.ageDiff > maxAgeSpread &&
				view.ageDiff > current.ageDiff
			) {
				continue;
			}

			const candidate: SwapSuggestion = {
				playerAId: a.playerId,
				playerBId: b.playerId,
				teamA: a.team,
				teamB: b.team,
				position: a.position,
				skillDiffBefore: currentSkill,
				skillDiffAfter: view.skillDiff ?? currentSkill,
				ageDiffBefore: current.ageDiff,
				ageDiffAfter: view.ageDiff
			};
			const scored = {
				candidate,
				counts,
				view,
				playerAId: a.playerId,
				playerBId: b.playerId
			};

			if (best === null || compareSwap(scored, best) < 0) {
				best = scored;
			}
		}
	}

	return best?.candidate ?? null;
}

function slotOrder(
	counts: Record<Team, number>
): (a: OpenSlot, b: OpenSlot) => number {
	return (a, b) =>
		counts[a.team] - counts[b.team] ||
		positionRank(a.position) - positionRank(b.position) ||
		a.index - b.index ||
		a.team.localeCompare(b.team);
}

/**
 * Comble les places ouvertes avec le bassin vivant. Chaque placement doit
 * laisser les comptes de violations inchangés ou meilleurs, puis rapprocher
 * la taille des équipes, les notes et l'âge. L'équipe la plus petite est
 * servie d'abord et l'état est recalculé après chaque joueur placé.
 */
export function fillSuggestions(input: {
	openSlots: readonly OpenSlot[];
	placements: readonly Placement[];
	/** Tous les joueurs du bassin, alignés ou non. */
	pool: readonly FillCandidate[];
	rules: readonly GeneratorRule[];
}): FillSuggestion[] {
	const placedIds = new Set(input.placements.map((placement) => placement.playerId));
	const poolById = new Map<string, FillCandidate>();
	for (const player of input.pool) {
		if (!poolById.has(player.id)) poolById.set(player.id, player);
	}
	const available = [...poolById.values()]
		.filter((player) => !placedIds.has(player.id))
		.sort((a, b) => a.id.localeCompare(b.id));
	const remainingSlots = uniqueSlots(input.openSlots);
	let placements = uniquePlacements(input.placements);
	let baseline = violationCounts(placements, input.rules);
	const used = new Set<string>();
	const result: FillSuggestion[] = [];

	while (remainingSlots.length > 0) {
		const counts = teamCounts(placements);
		const slots = [...remainingSlots].sort(slotOrder(counts));
		let best:
			| {
					slot: OpenSlot;
					player: FillCandidate;
					placements: Placement[];
					counts: ViolationCounts;
					view: BalanceView;
			  }
			| undefined;

		for (const slot of slots) {
			for (const player of available) {
				if (used.has(player.id)) continue;
				const eligible = player.eligiblePositions ?? [player.position];
				if (!eligible.includes(slot.position)) continue;

				const candidatePlacements = [
					...placements,
					{ playerId: player.id, team: slot.team, position: slot.position }
				];
				const candidateCounts = violationCounts(candidatePlacements, input.rules);
				if (candidateCounts.strict > baseline.strict) continue;
				if (candidateCounts.soft > baseline.soft) continue;

				const view = balanceView(candidatePlacements, input.pool);
				const scored = {
					slot,
					player,
					placements: candidatePlacements,
					counts: candidateCounts,
					view
				};

				if (best === undefined) {
					best = scored;
					continue;
				}

				const comparison =
					candidateCounts.strict - best.counts.strict ||
					candidateCounts.soft - best.counts.soft ||
					view.sizeDiff - best.view.sizeDiff ||
					skillValue(view) - skillValue(best.view) ||
					view.ageDiff - best.view.ageDiff ||
					positionRank(slot.position) -
						positionRank(best.slot.position) ||
					slot.index - best.slot.index ||
					slot.team.localeCompare(best.slot.team) ||
					player.id.localeCompare(best.player.id);
				if (comparison < 0) best = scored;
			}
		}

		if (!best) break;

		const index = remainingSlots.findIndex(
			(slot) => openSlotKey(slot) === openSlotKey(best!.slot)
		);
		if (index >= 0) remainingSlots.splice(index, 1);
		placements = best.placements;
		baseline = best.counts;
		used.add(best.player.id);
		result.push({ slot: best.slot, playerId: best.player.id });
	}

	return result;
}

export function violationsFor(
	placements: readonly Placement[],
	rules: readonly GeneratorRule[]
): GeneratorViolation[] {
	return pairViolations(teamOf(uniquePlacements(placements)), rules);
}
