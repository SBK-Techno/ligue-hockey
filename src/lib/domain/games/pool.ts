import { comparePositionThenKind, positionRank, type Position } from '#config/positions.ts';
import { rosterTemplateSchema, type RosterTemplate } from '#config/roster.ts';
import type { SettingsValues } from '#config/settings-registry.ts';
import type { Team } from '#config/teams.ts';
import { generationCandidates, playerCandidatesByIds } from '#lib/domain/players/candidates.ts';
import { neutralPlayerName } from '#lib/domain/players/public.ts';
import { overallsForPlayers } from '#lib/domain/ratings/overall.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { claimsForGeneration } from '#lib/domain/subs/generation.ts';
import type { OpenSlot, Placement } from '#lib/domain/teams/balance.ts';
import type { GeneratorPlayer } from '#lib/domain/teams/generator.ts';
import { AppError } from '#lib/shared/errors.ts';
import { listAvailability } from './queries.ts';
import { isLineupEditable } from './playability.ts';
import type { GameRow } from './schema.ts';
import {
	selectGenerationPlayers,
	type BenchPlayer,
	type SelectionCandidate
} from './selection.ts';

export type PoolSlot = {
	team: Team;
	position: Position;
	slotIndex: number;
	player: { playerId: string; kind: 'regular' | 'sub' } | null;
};

/** Un membre vivant du bassin, avec sa note réelle ou son absence de note. */
export type LineupMember = SelectionCandidate & {
	name: string;
	age: number;
	jerseyNumber: number | null;
	avatarId: string | null;
	overall: number | null;
	placed: boolean;
};

export type EligiblePlayer = LineupMember & { overall: number };

export type LineupPool = {
	template: RosterTemplate;
	settings: SettingsValues;
	placed: Placement[];
	openSlots: OpenSlot[];
	/** Membres vivants et joueurs déjà placés qui ont une note complète. */
	players: Map<string, EligiblePlayer>;
	/** Tous les membres vivants, notés ou non. */
	members: LineupMember[];
	/** Membres notés et non placés, seuls candidats au comblement. */
	available: EligiblePlayer[];
	/** Membres vivants sans place, pour l'affichage et le snapshot. */
	bench: BenchPlayer[];
	/** Les places publiées : un joueur hors du bassin vivant n'y figure plus. */
	slots: PoolSlot[];
	/** Noms des joueurs sans note complète, jamais remplacés par 0. */
	unrated: string[];
	names: Map<string, string>;
	kindOf: Map<string, 'regular' | 'sub'>;
};

export type GenerationPlan = {
	players: GeneratorPlayer[];
	bench: BenchPlayer[];
	kindOf: Map<string, 'regular' | 'sub'>;
};

export function templateFromRow(row: GameRow): RosterTemplate {
	try {
		return rosterTemplateSchema.parse(JSON.parse(row.rosterTemplateJson));
	} catch (cause) {
		throw new AppError('INTERNAL', {
			message: 'Invalid roster template snapshot',
			cause
		});
	}
}

function benchPlayer(member: LineupMember): BenchPlayer {
	return {
		playerId: member.playerId,
		position: member.eligiblePositions[0] ?? member.position,
		kind: member.kind
	};
}

function uniqueBench(entries: readonly BenchPlayer[]): BenchPlayer[] {
	const seen = new Set<string>();
	const unique: BenchPlayer[] = [];
	for (const entry of entries) {
		if (seen.has(entry.playerId)) continue;
		seen.add(entry.playerId);
		unique.push(entry);
	}
	return unique.sort(
		(a, b) =>
			comparePositionThenKind(a, b) || a.playerId.localeCompare(b.playerId)
	);
}

/**
 * Le banc d'un alignement : les membres vivants que la formation ne place
 * pas. C'est la seule projection du banc, pour le bassin comme pour
 * l'éditeur; un joueur sorti de la glace n'y retourne jamais par erreur.
 */
export function benchFromMembers(
	members: readonly LineupMember[],
	dressedIds: ReadonlySet<string>
): BenchPlayer[] {
	return uniqueBench(
		members
			.filter((member) => !dressedIds.has(member.playerId))
			.map(benchPlayer)
	);
}

/**
 * Construit le seul bassin vivant du match : joueurs placés, réguliers
 * présents et remplaçants réclamés. La génération et les actions
 * d'alignement lisent ce même bassin, jamais le banc enregistré.
 */
export function lineupPool(row: GameRow, slots: readonly PoolSlot[]): LineupPool {
	const gameId = row.id;
	const settings = getSettings();
	const template = templateFromRow(row);
	const active = new Map(
		generationCandidates().map((player) => [player.userId, player])
	);
	const presenceRows = listAvailability(gameId);
	const presence = new Map(presenceRows.map((entry) => [entry.playerId, entry.status]));
	const availability = presenceRows.filter((entry) => entry.status === 'present');
	const presenceOrder = new Map(
		availability.map((entry) => [entry.playerId, entry.updatedAt])
	);

	const claimsByPlayer = new Map<
		string,
		{ position: Position; filledAt: number }[]
	>();
	for (const claim of claimsForGeneration(gameId)) {
		const entries = claimsByPlayer.get(claim.playerId) ?? [];
		entries.push({ position: claim.position, filledAt: claim.filledAt ?? 0 });
		claimsByPlayer.set(claim.playerId, entries);
	}
	for (const entries of claimsByPlayer.values()) {
		entries.sort(
			(a, b) =>
				a.filledAt - b.filledAt ||
				positionRank(a.position) - positionRank(b.position)
		);
	}

	const memberIds = new Set<string>();
	for (const entry of availability) {
		const player = active.get(entry.playerId);
		if (player && !player.isSubstitute) memberIds.add(player.userId);
	}
	for (const playerId of claimsByPlayer.keys()) {
		if (active.has(playerId)) memberIds.add(playerId);
	}

	// La place publiée suit le bassin vivant : un retrait explicite, une
	// réclamation libérée ou un compte désactivé ne laisse jamais un joueur
	// sur la glace. Un match commencé ou terminé garde ses participants.
	const stillLive = (slot: PoolSlot): boolean => {
		if (!slot.player) return true;
		if (!active.has(slot.player.playerId)) return false;
		if (slot.player.kind === 'sub') return claimsByPlayer.has(slot.player.playerId);
		return presence.get(slot.player.playerId) !== 'absent';
	};
	const publishedSlots =
		row.status === 'scheduled' &&
		isLineupEditable({ status: row.status, gameDate: row.gameDate, startTime: row.startTime })
			? slots.map((slot) => (stillLive(slot) ? slot : { ...slot, player: null }))
			: [...slots];
	const dressedSlots = publishedSlots.filter((slot) => slot.player !== null);
	const dressedIds = new Set(dressedSlots.map((slot) => slot.player!.playerId));
	const dressedPosition = new Map(
		dressedSlots.map((slot) => [slot.player!.playerId, slot.position])
	);
	const dressedKind = new Map(
		dressedSlots.map((slot) => [slot.player!.playerId, slot.player!.kind])
	);

	const missingPlacedIds = [...dressedIds].filter((playerId) => !active.has(playerId));
	const placedOnly = new Map(
		playerCandidatesByIds(missingPlacedIds).map((player) => [player.userId, player])
	);
	const detailOf = (playerId: string) => active.get(playerId) ?? placedOnly.get(playerId);

	const allIds = new Set<string>([...memberIds, ...dressedIds]);
	const names = new Map<string, string>();
	for (const playerId of allIds) {
		names.set(playerId, detailOf(playerId)?.fullName ?? neutralPlayerName());
	}

	const overalls = overallsForPlayers([...allIds]);
	const members: LineupMember[] = [];
	const kindOf = new Map<string, 'regular' | 'sub'>();

	for (const playerId of memberIds) {
		const detail = detailOf(playerId);
		if (!detail) continue;
		const claims = claimsByPlayer.get(playerId) ?? [];
		const eligiblePositions =
			claims.length > 0
				? [...new Set(claims.map((claim) => claim.position))]
				: [detail.position];
		const kind: 'regular' | 'sub' = claims.length > 0 ? 'sub' : 'regular';
		const order =
			claims.length > 0
				? (claims[0]?.filledAt ?? 0)
				: (presenceOrder.get(playerId) ?? 0);
		kindOf.set(playerId, kind);
		members.push({
			playerId,
			name: detail.fullName,
			position: detail.position,
			eligiblePositions,
			kind,
			order,
			age: detail.age,
			jerseyNumber: detail.jerseyNumber,
			avatarId: detail.avatarId,
			overall: overalls.get(playerId) ?? null,
			placed: dressedIds.has(playerId)
		});
	}

	members.sort(
		(a, b) =>
			comparePositionThenKind(a, b) ||
			a.order - b.order ||
			a.playerId.localeCompare(b.playerId)
	);

	const players = new Map<string, EligiblePlayer>();
	for (const member of members) {
		if (member.overall === null) continue;
		players.set(member.playerId, member as EligiblePlayer);
	}
	for (const playerId of dressedIds) {
		if (!kindOf.has(playerId)) {
			kindOf.set(playerId, dressedKind.get(playerId) ?? 'regular');
		}
		if (players.has(playerId)) continue;
		const overall = overalls.get(playerId);
		const detail = detailOf(playerId);
		if (overall === undefined || !detail) continue;
		const claims = claimsByPlayer.get(playerId) ?? [];
		const kind = dressedKind.get(playerId) ?? 'regular';
		const member: EligiblePlayer = {
			playerId,
			name: detail.fullName,
			position: detail.position,
			eligiblePositions:
				claims.length > 0
					? [...new Set(claims.map((claim) => claim.position))]
					: [dressedPosition.get(playerId) ?? detail.position],
			kind,
			order: 0,
			age: detail.age,
			jerseyNumber: detail.jerseyNumber,
			avatarId: detail.avatarId,
			overall,
			placed: true
		};
		players.set(playerId, member);
	}

	const unrated = [...allIds]
		.filter((playerId) => !overalls.has(playerId))
		.map((playerId) => names.get(playerId) ?? neutralPlayerName())
		.sort((a, b) => a.localeCompare(b));

	const available = members
		.filter((member) => !member.placed && member.overall !== null)
		.map((member) => member as EligiblePlayer)
		.sort((a, b) => a.order - b.order || a.playerId.localeCompare(b.playerId));

	const bench = benchFromMembers(members, dressedIds);

	return {
		template,
		settings,
		placed: dressedSlots.map((slot) => ({
			playerId: slot.player!.playerId,
			team: slot.team,
			position: slot.position
		})),
		openSlots: publishedSlots
			.filter((slot) => slot.player === null)
			.map((slot) => ({
				team: slot.team,
				position: slot.position,
				index: slot.slotIndex
			})),
		players,
		members,
		available,
		bench,
		slots: publishedSlots,
		unrated,
		names,
		kindOf
	};
}

/**
 * Entrées du générateur : les membres notés, au plus la capacité de chaque
 * poste. Le reste, y compris les joueurs sans note, forme le banc enregistré.
 */
export function generationPlan(pool: LineupPool): GenerationPlan {
	const rated = pool.members.filter(
		(member): member is EligiblePlayer => member.overall !== null
	);
	const selection = selectGenerationPlayers(rated, pool.template);
	const selectedIds = new Set(selection.selected.map((member) => member.playerId));
	const bench = uniqueBench(
		pool.members.filter((member) => !selectedIds.has(member.playerId)).map(benchPlayer)
	);

	return {
		players: selection.selected.map((member) => ({
			id: member.playerId,
			position: member.selectionPosition,
			age: member.age,
			overall: member.overall,
			kind: member.kind
		})),
		bench,
		kindOf: pool.kindOf
	};
}
