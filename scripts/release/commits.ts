import type { ReleasePolicy } from '#config/release.ts';
import type { Bump } from './version.ts';

export type ReleaseCommit = { subject: string; body: string };
export type ReleaseBump = Bump | 'none';

export type ParsedCommit = {
	type: string | null;
	scope: string | null;
	breaking: boolean;
	description: string;
};

const CONVENTIONAL =
	/^(?<type>[a-z][a-z0-9-]*)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s+(?<description>.+)$/i;

const PRIORITY: Record<ReleaseBump, number> = {
	none: 0,
	patch: 1,
	minor: 2,
	major: 3
};

export function parseCommit(commit: ReleaseCommit): ParsedCommit {
	const match = CONVENTIONAL.exec(commit.subject.trim());
	if (!match?.groups) {
		return {
			type: null,
			scope: null,
			breaking: false,
			description: commit.subject.trim()
		};
	}
	return {
		type: match.groups.type.toLowerCase(),
		scope: match.groups.scope ?? null,
		breaking: Boolean(match.groups.breaking),
		description: match.groups.description
	};
}

function highest(left: ReleaseBump, right: ReleaseBump): ReleaseBump {
	return PRIORITY[right] > PRIORITY[left] ? right : left;
}

/**
 * Une seule règle décide de la montée de version. Les commits de version et
 * de documentation ne déclenchent pas de publication; une rupture l'emporte
 * toujours; une fonctionnalité passe en mineure; le reste retombe sur la
 * politique par défaut.
 */
export function classifyCommits(
	commits: readonly ReleaseCommit[],
	policy: ReleasePolicy
): ReleaseBump {
	let bump: ReleaseBump = 'none';

	for (const commit of commits) {
		const parsed = parseCommit(commit);

		const breaking =
			parsed.breaking ||
			policy.breakingMarkers.some((marker) => commit.body.includes(marker));
		if (breaking) return 'major';

		if (parsed.type && policy.ignoreTypes.includes(parsed.type)) continue;

		if (parsed.type && policy.minorTypes.includes(parsed.type)) {
			bump = highest(bump, 'minor');
			continue;
		}

		bump = highest(bump, policy.defaultBump);
	}

	return bump;
}
