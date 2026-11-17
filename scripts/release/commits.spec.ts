import { describe, expect, it } from 'vitest';
import { RELEASE_POLICY } from '#config/release.ts';
import { classifyCommits, parseCommit } from './commits.ts';

describe('commits', () => {
	it.each([
		['feat: ajouter un écran', 'feat', null, false, 'ajouter un écran'],
		['fix(chat): corriger le scroll', 'fix', 'chat', false, 'corriger le scroll'],
		['feat!: remplacer le schéma', 'feat', null, true, 'remplacer le schéma'],
		['un message sans type', null, null, false, 'un message sans type']
	])('parse %s', (subject, type, scope, breaking, description) => {
		expect(parseCommit({ subject, body: '' })).toEqual({
			type,
			scope,
			breaking,
			description
		});
	});

	it.each([
		['feat: something', '', 'minor'],
		['fix: something', '', 'patch'],
		['perf: something', '', 'patch'],
		['unknown: something', '', 'patch'],
		['chore: something', '', 'none'],
		['docs: something', '', 'none'],
		['test: something', '', 'none'],
		['feat!: something', '', 'major'],
		['fix: something', 'BREAKING CHANGE: new contract', 'major'],
		['docs: something', 'BREAKING-CHANGE: new contract', 'major'],
		['chore: something', 'routine', 'none'],
		['feat: something', 'BREAKING CHANGE: new contract', 'major']
	] as const)('classifies %s with body %s', (subject, body, expected) => {
		expect(classifyCommits([{ subject, body }], RELEASE_POLICY)).toBe(expected);
	});

	it('takes the highest bump across commits', () => {
		expect(
			classifyCommits(
				[
					{ subject: 'fix: a', body: '' },
					{ subject: 'feat: b', body: '' },
					{ subject: 'docs: c', body: '' }
				],
				RELEASE_POLICY
			)
		).toBe('minor');
	});

	it('returns none without a release commit', () => {
		expect(classifyCommits([], RELEASE_POLICY)).toBe('none');
		expect(
			classifyCommits(
				[
					{ subject: 'chore(release): 1.2.0', body: '' },
					{ subject: 'docs: readme', body: '' }
				],
				RELEASE_POLICY
			)
		).toBe('none');
	});

	it('lets a breaking change win over an ignored type', () => {
		expect(
			classifyCommits(
				[{ subject: 'chore!: drop node 22', body: '' }],
				RELEASE_POLICY
			)
		).toBe('major');
	});
});
