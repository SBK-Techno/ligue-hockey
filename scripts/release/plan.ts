import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RELEASE_POLICY, type ReleasePolicy } from '#config/release.ts';
import { classifyCommits, type ReleaseBump, type ReleaseCommit } from './commits.ts';
import {
	bumpVersion,
	compareVersions,
	formatVersion,
	parseVersion,
	type Bump
} from './version.ts';

export type ReleaseMode = 'none' | 'prepare' | 'publish';

export type ReleasePlan = {
	mode: ReleaseMode;
	currentVersion: string;
	latestTag: string | null;
	version: string | null;
	tag: string | null;
	bump: ReleaseBump;
	branch: string;
	reason: 'first-release' | 'prepared-version' | 'release-commits' | 'no-release-commits';
	commitCount: number;
};

export type PlanInput = {
	currentVersion: string;
	latestTag: string | null;
	commits: readonly ReleaseCommit[];
	policy: ReleasePolicy;
};

function tagVersion(tag: string, prefix: string): string | null {
	if (!tag.startsWith(prefix)) return null;
	const value = tag.slice(prefix.length);
	try {
		parseVersion(value);
		return value;
	} catch {
		return null;
	}
}

export function latestVersionTag(tags: readonly string[], policy: ReleasePolicy): string | null {
	let latest: { tag: string; version: ReturnType<typeof parseVersion> } | null = null;

	for (const tag of tags) {
		const value = tagVersion(tag, policy.tagPrefix);
		if (!value) continue;
		const version = parseVersion(value);
		if (!latest || compareVersions(version, latest.version) > 0) {
			latest = { tag, version };
		}
	}

	return latest?.tag ?? null;
}

/**
 * Décide s'il faut publier la version déjà présente dans package.json,
 * préparer une nouvelle version, ou ne rien faire. Fonction pure : le CLI
 * fournit l'état de Git, les tests fournissent des tables.
 */
export function planRelease(input: PlanInput): ReleasePlan {
	const { currentVersion, latestTag, commits, policy } = input;
	const current = parseVersion(currentVersion);
	const commitCount = commits.length;

	if (!latestTag) {
		return {
			mode: 'publish',
			currentVersion,
			latestTag: null,
			version: currentVersion,
			tag: `${policy.tagPrefix}${currentVersion}`,
			bump: 'none',
			branch: policy.branch,
			reason: 'first-release',
			commitCount
		};
	}

	const tagged = tagVersion(latestTag, policy.tagPrefix);
	if (!tagged) {
		throw new Error(`Étiquette invalide: ${latestTag}. Préfixe attendu: ${policy.tagPrefix}.`);
	}
	const latest = parseVersion(tagged);
	const comparison = compareVersions(current, latest);

	if (comparison < 0) {
		throw new Error(
			`package.json (${currentVersion}) est derrière l'étiquette ${latestTag}.`
		);
	}

	if (comparison > 0) {
		return {
			mode: 'publish',
			currentVersion,
			latestTag,
			version: currentVersion,
			tag: `${policy.tagPrefix}${currentVersion}`,
			bump: 'none',
			branch: policy.branch,
			reason: 'prepared-version',
			commitCount
		};
	}

	const bump = classifyCommits(commits, policy);
	if (bump === 'none') {
		return {
			mode: 'none',
			currentVersion,
			latestTag,
			version: null,
			tag: null,
			bump,
			branch: policy.branch,
			reason: 'no-release-commits',
			commitCount
		};
	}

	const version = formatVersion(bumpVersion(current, bump as Bump));
	return {
		mode: 'prepare',
		currentVersion,
		latestTag,
		version,
		tag: `${policy.tagPrefix}${version}`,
		bump,
		branch: policy.branch,
		reason: 'release-commits',
		commitCount
	};
}

function git(root: string, args: string[]): string {
	return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export function readReleaseState(
	root: string,
	policy: ReleasePolicy
): { latestTag: string | null; commits: ReleaseCommit[] } {
	const tags = git(root, ['tag', '--list']).split('\n').filter(Boolean);
	const latestTag = latestVersionTag(tags, policy);
	const range = latestTag ? `${latestTag}..HEAD` : 'HEAD';
	const raw = execFileSync(
		'git',
		['log', '--no-merges', '--format=%s%x1f%b%x1e', range],
		{ cwd: root, encoding: 'utf8' }
	);

	const commits = raw
		.split('\x1e')
		.map((record) => record.trim())
		.filter(Boolean)
		.map((record) => {
			const [subject, ...body] = record.split('\x1f');
			return { subject: subject.trim(), body: body.join('\x1f').trim() };
		});

	return { latestTag, commits };
}

function readVersion(root: string): string {
	const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
		version?: string;
	};
	if (!packageJson.version) throw new Error('package.json ne déclare pas de version.');
	return packageJson.version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const root = process.cwd();
		const state = readReleaseState(root, RELEASE_POLICY);
		const plan = planRelease({
			currentVersion: readVersion(root),
			latestTag: state.latestTag,
			commits: state.commits,
			policy: RELEASE_POLICY
		});
		process.stdout.write(`${JSON.stringify(plan)}\n`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
