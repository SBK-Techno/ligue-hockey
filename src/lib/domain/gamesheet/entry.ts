import type { Team } from '#config/teams.ts';
import { neutralPlayerName } from '#lib/domain/players/public.ts';
import { AppError } from '#lib/shared/errors.ts';
import type { NewGameGoalRow } from './schema.ts';
import { goalEntryOptions } from './options.ts';
import type { GoalInput } from './validators.ts';

/**
 * La construction d'un but à partir de la feuille : une seule résolution des
 * joueurs habillés, des noms et des numéros, partagée par le service et par
 * le jeu de démonstration. Aucun appelant ne réécrit les règles des aides.
 */
export type GoalEntryPlayer = {
	playerId: string;
	fullName: string;
	jerseyNumber: number | null;
};

export type GoalEntrySlot = {
	team: Team;
	player: GoalEntryPlayer | null;
};

export type GoalEntryGame = {
	slots: readonly GoalEntrySlot[];
};

export type GoalEntryMeta = {
	id: string;
	gameId: string;
	createdAt: number;
	createdBy: string | null;
	names: ReadonlyMap<string, string>;
};

function dressedKey(team: Team, playerId: string): string {
	return `${team}:${playerId}`;
}

function dressedSlots(game: GoalEntryGame): Map<string, GoalEntryPlayer> {
	const slots = new Map<string, GoalEntryPlayer>();
	for (const slot of game.slots) {
		if (!slot.player) continue;
		slots.set(dressedKey(slot.team, slot.player.playerId), slot.player);
	}
	return slots;
}

function requireDressed(
	slots: ReadonlyMap<string, GoalEntryPlayer>,
	team: Team,
	playerId: string,
	names: ReadonlyMap<string, string>,
	key:
		| 'gamesheet.scorerNotDressed'
		| 'gamesheet.assistNotDressed'
		| 'gamesheet.penaltyPlayerNotDressed'
): GoalEntryPlayer {
	const player = slots.get(dressedKey(team, playerId));
	if (!player) {
		throw new AppError('VALIDATION', {
			key,
			params: { name: names.get(playerId) ?? neutralPlayerName() }
		});
	}
	return player;
}

/**
 * Vérifie que le but appartient bien à des joueurs habillés de la même équipe.
 * Le gardien peut marquer ou être crédité d'une aide : il occupe une place
 * comme les autres et aucune position ne restreint la feuille.
 */
export function resolveGoalEntry(
	game: GoalEntryGame,
	input: GoalInput,
	names: ReadonlyMap<string, string>
): {
	scorer: GoalEntryPlayer;
	assists: { slot: GoalEntryPlayer; playerId: string }[];
} {
	const slots = dressedSlots(game);
	// Un but contre son camp crédite l'autre camp, mais le buteur appartient
	// à l'équipe qui l'a marqué contre elle-même. Le même propriétaire décide
	// des options offertes par le formulaire.
	const entry = goalEntryOptions(input.team, input.kind);
	const scoringTeam = entry.scorerTeam;
	const scorer = requireDressed(
		slots,
		scoringTeam,
		input.scorerPlayerId,
		names,
		'gamesheet.scorerNotDressed'
	);

	const assistIds = [input.assist1PlayerId, input.assist2PlayerId].filter(
		(value): value is string => value !== null
	);
	if (!entry.assistsAllowed && assistIds.length > 0) {
		throw new AppError('VALIDATION', { key: 'gamesheet.ownGoalNoAssists' });
	}
	const seen = new Set<string>();
	for (const assistId of assistIds) {
		if (assistId === input.scorerPlayerId) {
			throw new AppError('VALIDATION', { key: 'gamesheet.assistIsScorer' });
		}
		if (seen.has(assistId)) {
			throw new AppError('VALIDATION', { key: 'gamesheet.assistDuplicate' });
		}
		seen.add(assistId);
	}
	for (const assistId of assistIds) {
		requireDressed(
			slots,
			scoringTeam,
			assistId,
			names,
			'gamesheet.assistNotDressed'
		);
	}

	return {
		scorer,
		assists: assistIds.map((playerId) => ({
			playerId,
			slot: slots.get(dressedKey(scoringTeam, playerId))!
		}))
	};
}

/** Le joueur puni, résolu par la même feuille que les buts. */
export function resolvePenaltyEntry(
	game: GoalEntryGame,
	team: Team,
	playerId: string,
	names: ReadonlyMap<string, string>
): GoalEntryPlayer {
	return requireDressed(
		dressedSlots(game),
		team,
		playerId,
		names,
		'gamesheet.penaltyPlayerNotDressed'
	);
}

/** La ligne complète d'un but, noms et numéros résolus par la feuille. */
export function goalRowFrom(
	game: GoalEntryGame,
	input: GoalInput,
	meta: GoalEntryMeta
): NewGameGoalRow {
	const resolved = resolveGoalEntry(game, input, meta.names);
	return {
		id: meta.id,
		gameId: meta.gameId,
		team: input.team,
		period: input.period,
		clock: input.clock,
		kind: input.kind,
		scorerPlayerId: input.scorerPlayerId,
		scorerName: resolved.scorer.fullName,
		scorerNumber: resolved.scorer.jerseyNumber,
		assist1PlayerId: input.assist1PlayerId,
		assist1Name: resolved.assists[0]?.slot.fullName ?? null,
		assist1Number: resolved.assists[0]?.slot.jerseyNumber ?? null,
		assist2PlayerId: input.assist2PlayerId,
		assist2Name: resolved.assists[1]?.slot.fullName ?? null,
		assist2Number: resolved.assists[1]?.slot.jerseyNumber ?? null,
		createdAt: meta.createdAt,
		createdBy: meta.createdBy,
		updatedAt: meta.createdAt
	};
}
