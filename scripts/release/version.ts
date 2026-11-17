export type Bump = 'major' | 'minor' | 'patch';
export type Version = { major: number; minor: number; patch: number };

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseVersion(value: string): Version {
	const match = VERSION_PATTERN.exec(value);
	if (!match) {
		throw new Error(`Version invalide: ${value}. Format attendu: major.minor.patch.`);
	}
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3])
	};
}

export function formatVersion(version: Version): string {
	return `${version.major}.${version.minor}.${version.patch}`;
}

export function compareVersions(left: Version, right: Version): number {
	return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

export function bumpVersion(version: Version, bump: Bump): Version {
	if (bump === 'major') return { major: version.major + 1, minor: 0, patch: 0 };
	if (bump === 'minor') return { major: version.major, minor: version.minor + 1, patch: 0 };
	return { major: version.major, minor: version.minor, patch: version.patch + 1 };
}

export function nextVersion(current: string, bump: Bump): string {
	return formatVersion(bumpVersion(parseVersion(current), bump));
}
