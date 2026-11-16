import type { I18nKey } from '#config/i18n/fr.ts';
import { branding } from '#lib/generated/branding.ts';
import { requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import {
	getGame,
	listGamePresence,
	regenerateIfGenerated,
	setGamePresence
} from '#lib/domain/games/service.ts';
import type { GameSummary } from '#lib/domain/games/types.ts';
import { generationCandidates, getOwnProfile, playersByIds } from '#lib/domain/players/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import {
	cancelForReturn,
	createAbsenceRequest
} from '#lib/domain/subs/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { formatCount, t } from '#lib/shared/i18n/index.ts';
import { clock, zonedDateTimeToMs } from '#lib/shared/time/clock.ts';
import type { AvailabilityStatus } from '#lib/domain/games/schema.ts';

export type AvailabilityRowView = {
	playerId: string;
	fullName: string;
	status: AvailabilityStatus;
};

export type AvailabilityView = {
	rows: AvailabilityRowView[];
	present: number;
	absent: number;
	unknown: number;
	summary: string;
	own: AvailabilityStatus | null;
	locked: boolean;
};

export type AvailabilityResult = {
	status: AvailabilityStatus;
	requestCreated: boolean;
	bumpedPlayerId: string | null;
	regenerated: boolean;
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
		t('availability.unknownCount', { count: counts.unknown })
	].join(' · ');
}

function isLocked(game: GameSummary): boolean {
	const settings = getSettings();
	const closesHours = settings['games.availabilityClosesHours'];
	return clock.nowMs() >= startMs(game) - closesHours * 60 * 60 * 1000;
}

export function getAvailability(actor: Actor, gameId: string): AvailabilityView {
	const user = requireUser(actor);
	const game = getGame(actor, gameId);
	const rows = listGamePresence(gameId);
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
	const unknown = roster.filter((player) => !answered.has(player.userId)).length;

	return {
		rows: rows.map((row) => ({
			playerId: row.playerId,
			fullName: names.get(row.playerId) ?? row.playerId,
			status: row.status
		})),
		present,
		absent,
		unknown,
		summary: availabilitySummary({ present, absent, unknown }),
		own,
		locked: isLocked(game)
	};
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
	if (isLocked(game)) {
		throw new AppError('CONFLICT', { key: 'availability.locked' });
	}

	setGamePresence(gameId, user.userId, status, clock.nowMs());

	let bumpedPlayerId: string | null = null;
	let requestCreated = false;
	if (status === 'absent') {
		if (getSettings()['notifications.subRequestOnAbsence']) {
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
	return {
		status,
		requestCreated,
		bumpedPlayerId,
		regenerated: regeneration.regenerated,
		...(regeneration.warning ? { warning: regeneration.warning } : {})
	};
}
