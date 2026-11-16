import type { Position } from '#config/positions.ts';
import type { Team } from '#config/teams.ts';

export type GameSummary = {
	id: string;
	gameDate: string;
	startTime: string;
	location: string;
	status: 'scheduled' | 'cancelled' | 'completed';
};

export type GamePlayer = {
	playerId: string;
	fullName: string;
	position: Position;
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
	kind: 'regular' | 'sub';
};

export type GameGenerationView = {
	skillDiff: number;
	ageDiff: number;
	sizeDiff: number;
	skillDiffLabel: string;
	ageDiffLabel: string;
	warnings: string[];
	bench: GameBenchView[];
	generatedAt: number;
};
