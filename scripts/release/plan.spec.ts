import { describe, expect, it } from 'vitest';
import { RELEASE_POLICY } from '#config/release.ts';
import { latestVersionTag, planRelease, type PlanInput } from './plan.ts';

const commit = (subject: string, body = '') => ({ subject, body });

function input(overrides: Partial<PlanInput> = {}): PlanInput {
	return {
		currentVersion: '1.1.0',
		latestTag: 'v1.1.0',
		commits: [commit('feat: something')],
		policy: RELEASE_POLICY,
		...overrides
	};
}

describe('latestVersionTag', () => {
	it('picks the highest valid tag', () => {
		expect(
			latestVersionTag(['v1.2.0', 'v1.10.0', 'v1.9.9', 'nope', 'v1.10'], RELEASE_POLICY)
		).toBe('v1.10.0');
	});

	it('returns null without a valid tag', () => {
		expect(latestVersionTag(['v1.0', '1.0.0'], RELEASE_POLICY)).toBeNull();
	});
});

describe('planRelease', () => {
	it('publishes the current version on a first release', () => {
		const plan = planRelease(input({ latestTag: null, currentVersion: '1.0.0' }));
		expect(plan).toMatchObject({
			mode: 'publish',
			version: '1.0.0',
			tag: 'v1.0.0',
			reason: 'first-release'
		});
	});

	it('publishes a version already prepared in package.json', () => {
		const plan = planRelease(
			input({ currentVersion: '1.3.0', latestTag: 'v1.1.0', commits: [] })
		);
		expect(plan).toMatchObject({
			mode: 'publish',
			version: '1.3.0',
			tag: 'v1.3.0',
			reason: 'prepared-version'
		});
	});

	it('prepares a minor release for a feature', () => {
		const plan = planRelease(input());
		expect(plan).toMatchObject({
			mode: 'prepare',
			version: '1.2.0',
			tag: 'v1.2.0',
			bump: 'minor'
		});
	});

	it('prepares a patch release for a fix', () => {
		const plan = planRelease(input({ commits: [commit('fix: something')] }));
		expect(plan).toMatchObject({ mode: 'prepare', version: '1.1.1', bump: 'patch' });
	});

	it('prepares a major release for a breaking change', () => {
		const plan = planRelease(input({ commits: [commit('feat!: something')] }));
		expect(plan).toMatchObject({ mode: 'prepare', version: '2.0.0', bump: 'major' });
	});

	it('does nothing when only ignored commits exist', () => {
		const plan = planRelease(
			input({ commits: [commit('chore: housekeeping'), commit('docs: readme')] })
		);
		expect(plan).toMatchObject({
			mode: 'none',
			version: null,
			tag: null,
			reason: 'no-release-commits'
		});
	});

	it('does nothing without commits since the tag', () => {
		expect(planRelease(input({ commits: [] }))).toMatchObject({ mode: 'none' });
	});

	it('rejects a package version behind the latest tag', () => {
		expect(() => planRelease(input({ currentVersion: '1.0.0' }))).toThrow(/derrière/);
	});
});
