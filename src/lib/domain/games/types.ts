import type { GameWarning } from '#config/game-warnings.ts';
import type { Position } from '#config/positions.ts';
import type { Team } from '#config/teams.ts';

export type GameSummary = {
	id: string;
	gameDate: string;
	startTime: string;
	locationId: string;
	/** Libellé figé du lieu pour ce match. Renommer le lieu ne le réécrit pas. */
	location: string;
	status: 'scheduled' | 'cancelled' | 'completed';
};

export type GamePlayer = {
	playerId: string;
	fullName: string;
	position: Position;
	jerseyNumber: number | null;
	kind: 'regular' | 'sub';
};

export type GameSlotView = {
	team: Team;
	position: Position;
	slotIndex: number;
	player: GamePlayer | null;
};

export type GameBenchView = {
	playerId: string;
	fullName: string;
	position: Position;
	jerseyNumber: number | null;
	kind: 'regular' | 'sub';
};

export type GameRuleViolationView = {
	ruleId: string;
	kind: 'must' | 'must_not';
	strict: boolean;
	playerIds: [string, string];
	names: [string, string];
};

export type GameGenerationView = {
	skillDiff: number | null;
	ageDiff: number | null;
	sizeDiff: number | null;
	skillDiffLabel: string | null;
	ageDiffLabel: string | null;
	warnings: GameWarning[];
	ruleViolations: GameRuleViolationView[];
	bench: GameBenchView[];
	generatedAt: number;
};
