import type { I18nKey } from '#config/i18n/fr.ts';
import { branding } from '#lib/generated/branding.ts';
import { requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import {
	getGame,
	listGamePresence,
	listPlayerAvailability,
	regenerateIfGenerated,
	setGamePresence
} from '#lib/domain/games/service.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';
import { generationCandidates, playersByIds } from '#lib/domain/players/candidates.ts';
import { findOwnProfile, getOwnProfile } from '#lib/domain/players/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import {
	cancelForReturn,
	createAbsenceRequest
} from '#lib/domain/subs/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { formatCount, formatTimestamp, t } from '#lib/shared/i18n/index.ts';
import { clock, zonedDateTimeToMs } from '#lib/shared/time/clock.ts';
import type { AvailabilityStatus } from '#lib/domain/games/schema.ts';

export type AvailabilityRowView = {
	playerId: string;
	fullName: string;
	status: AvailabilityStatus;
};

export type AvailabilityPendingView = {
	playerId: string;
	fullName: string;
};

export type AvailabilityView = {
	rows: AvailabilityRowView[];
	pending: AvailabilityPendingView[];
	present: number;
	absent: number;
	unknown: number;
	summary: string;
	own: AvailabilityStatus | null;
	locked: boolean;
	canRespond: boolean;
	/** Après la fermeture, un joueur déjà présent peut encore se retirer. */
	canWithdraw: boolean;
	substitute: boolean;
	closesAtLabel: string;
};

/**
 * La situation personnelle sur plusieurs matchs, pour un agenda qui montre
 * la réponse de chacun sans ouvrir chaque feuille de présence.
 */
export function myAvailabilityByGame(
	actor: Actor,
	gameIds: readonly string[]
): Map<string, AvailabilityStatus> {
	const user = requireUser(actor);
	return new Map(
		listPlayerAvailability(gameIds, user.userId).map((row) => [row.gameId, row.status])
	);
}

export type AvailabilityResult = {
	status: AvailabilityStatus;
	requestCreated: boolean;
	bumpedPlayerId: string | null;
	regenerated: boolean;
	/** Message de confirmation à afficher, déjà choisi selon l'effet produit. */
	messageKey: I18nKey;
	warning?: I18nKey;
};

function startMs(game: GameSummary): number {
	return zonedDateTimeToMs(game.gameDate, game.startTime, branding.timezone);
}

function availabilitySummary(counts: {
	present: number;
	absent: number;
	unknown: number;
}): string {
	return [
		formatCount(
			counts.present,
			'availability.present.one',
			'availability.present.many'
		),
		formatCount(
			counts.absent,
			'availability.absent.one',
			'availability.absent.many'
		),
		...(counts.unknown > 0
			? [t('availability.unknownCount', { count: counts.unknown })]
			: [])
	].join(' · ');
}

function closesAtMs(game: GameSummary): number {
	const settings = getSettings();
	const closesHours = settings['games.availabilityClosesHours'];
	return startMs(game) - closesHours * 60 * 60 * 1000;
}

function isLocked(game: GameSummary): boolean {
	return clock.nowMs() >= closesAtMs(game);
}

export function availabilityForGame(actor: Actor, game: GameSummary): AvailabilityView {
	const user = requireUser(actor);
	const rows = listGamePresence(game.id);
	const names = new Map(
		playersByIds(rows.map((row) => row.playerId)).map((player) => [
			player.userId,
			player.fullName
		])
	);
	const roster = generationCandidates().filter((player) => !player.isSubstitute);
	const answered = new Set(rows.map((row) => row.playerId));
	const own = rows.find((row) => row.playerId === user.userId)?.status ?? null;
	const present = rows.filter((row) => row.status === 'present').length;
	const absent = rows.filter((row) => row.status === 'absent').length;
	const pending = roster
		.filter((player) => !answered.has(player.userId))
		.map((player) => ({
			playerId: player.userId,
			fullName: player.fullName
		}));
	const profile = findOwnProfile(actor);
	const locked = isLocked(game);

	return {
		rows: rows.map((row) => ({
			playerId: row.playerId,
			fullName: names.get(row.playerId) ?? row.playerId,
			status: row.status
		})),
		pending,
		present,
		absent,
		unknown: pending.length,
		summary: availabilitySummary({ present, absent, unknown: pending.length }),
		own,
		locked,
		canRespond:
			game.status === 'scheduled' && !locked && profile !== null && !profile.isSubstitute,
		canWithdraw:
			game.status === 'scheduled' &&
			locked &&
			profile !== null &&
			!profile.isSubstitute &&
			own === 'present',
		substitute: profile?.isSubstitute ?? false,
		closesAtLabel: formatTimestamp(closesAtMs(game))
	};
}

export function getAvailability(actor: Actor, gameId: string): AvailabilityView {
	return availabilityForGame(actor, getGame(actor, gameId));
}

export function markAvailability(
	actor: Actor,
	gameId: string,
	status: AvailabilityStatus
): AvailabilityResult {
	const user = requireUser(actor);
	const player = getOwnProfile(actor);
	if (player.isSubstitute) {
		throw new AppError('FORBIDDEN', { key: 'availability.substituteNoConfirm' });
	}

	const game = getGame(actor, gameId);
	if (game.status !== 'scheduled') {
		throw new AppError('CONFLICT', { key: 'availability.gameClosed' });
	}
	// La date limite ferme l'inscription, pas la sortie : celui qui doit
	// annuler peut encore le faire et ouvre aussitôt une place de remplaçant.
	if (isLocked(game) && status === 'present') {
		throw new AppError('CONFLICT', { key: 'availability.locked' });
	}

	const previous =
		listGamePresence(gameId).find((row) => row.playerId === user.userId)?.status ?? null;

	setGamePresence(gameId, user.userId, status, clock.nowMs());

	let bumpedPlayerId: string | null = null;
	let requestCreated = false;
	if (status === 'absent') {
		// Une place ne s'ouvre que si le joueur était réellement attendu.
		if (previous === 'present' && getSettings()['notifications.subRequestOnAbsence']) {
			const request = createAbsenceRequest(actor, game, player);
			requestCreated = request !== null;
		}
	} else {
		bumpedPlayerId = cancelForReturn(actor, game, user.userId);
	}

	recordAudit(actor, {
		action: 'availability.set',
		entityType: 'game',
		entityId: gameId,
		metadata: { status }
	});

	const regeneration = regenerateIfGenerated(gameId);
	const messageKey: I18nKey = bumpedPlayerId
		? 'availability.savedBumped'
		: requestCreated
			? 'availability.savedRequested'
			: status === 'absent'
				? 'availability.absenceSaved'
				: 'availability.saved';
	return {
		status,
		requestCreated,
		bumpedPlayerId,
		regenerated: regeneration.regenerated,
		messageKey,
		...(regeneration.warning ? { warning: regeneration.warning } : {})
	};
}
